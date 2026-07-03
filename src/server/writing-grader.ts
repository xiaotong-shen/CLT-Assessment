import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { WRITING_RUBRIC, type RubricTrait } from "./writing-rubric";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TraitScore {
  trait: string;
  score: number; // 1–5
  rationale: string;
}

export interface GradingResult {
  scoredTraits: TraitScore[];
  scoredLevel: number; // 1–5 weighted average
  modelRationale: string;
  model: string;
  rubricVersion: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const GRADER_MODEL = "claude-haiku-4-5";

/**
 * Whether the Anthropic API is configured. When false, callers should skip
 * grading and fall back to a placeholder — no key, no crash.
 *
 * Set ANTHROPIC_API_KEY in .env.local (see .env.example) to enable grading.
 */
export function isGraderConfigured(): boolean {
  const key = process.env["ANTHROPIC_API_KEY"];
  return !!key && key !== "placeholder" && key.length > 20;
}

// ----------------------------------------------------------------------------
// Prompt builder
// ----------------------------------------------------------------------------

function buildSystemPrompt(traits: RubricTrait[]): string {
  const traitList = traits
    .map(
      (t, i) =>
        `${i + 1}. **${t.label}** (field: "${t.name}", weight ${t.weight}) — ${t.description}`
    )
    .join("\n");

  const scaleList = Object.entries(WRITING_RUBRIC.scale)
    .map(([n, d]) => `  ${n} – ${d}`)
    .join("\n");

  return `You are an expert ESL/ELD writing assessor for a Canadian secondary school.
You evaluate student essays according to the Ontario ESL/ELD curriculum framework (proficiency Levels 1–5).

Rubric version: ${WRITING_RUBRIC.version}

Score each essay on the following traits on a scale of 1–5:
${traitList}

Scoring scale per trait:
${scaleList}

Guidelines:
- Be fair but rigorous. Students are writing in English as a second/additional language — assess what they CAN do, not only their errors.
- A beginner who writes simple sentences well should still score in the middle range on Task Fulfillment if the task is met.
- The overall level is the weighted mean of the trait scores, rounded to the nearest integer.

Respond ONLY with a JSON object matching this exact shape — no markdown fences, no extra keys:
{
  "traits": [
    { "trait": "<field name>", "score": <1-5>, "rationale": "<1–2 sentences>" }
  ],
  "overallLevel": <1-5>,
  "rationale": "<2–3 sentence overall assessment>"
}`;
}

// ----------------------------------------------------------------------------
// Grade an essay
// ----------------------------------------------------------------------------

export async function gradeEssay(params: {
  promptTextEn: string;
  essayText: string;
  itemLevel: number;
}): Promise<GradingResult> {
  if (!isGraderConfigured()) {
    throw new Error(
      "Writing grader is not configured: set ANTHROPIC_API_KEY in the environment."
    );
  }

  const client = new Anthropic();
  const systemPrompt = buildSystemPrompt(WRITING_RUBRIC.traits);

  const userMessage =
    `Writing prompt (target Level ${params.itemLevel}):\n${params.promptTextEn}\n\n` +
    `Student essay:\n---\n${params.essayText.trim()}\n---\n\n` +
    `Score this essay according to the rubric. Respond ONLY with the JSON object.`;

  const response = await client.messages.create({
    model: GRADER_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPrompt,
        // Cache the stable rubric system prompt across repeated grading calls
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Grading API returned no text content");
  }

  // Extract JSON — tolerate accidental markdown fences
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse grading JSON from: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    traits: { trait: string; score: number; rationale: string }[];
    overallLevel: number;
    rationale: string;
  };

  return {
    scoredTraits: parsed.traits,
    scoredLevel: Math.round(parsed.overallLevel),
    modelRationale: parsed.rationale,
    model: GRADER_MODEL,
    rubricVersion: WRITING_RUBRIC.version,
  };
}
