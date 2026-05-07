import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { rubrics } from "../../db/schema";
import { eq } from "drizzle-orm";

const client = new Anthropic();

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

// ----------------------------------------------------------------------------
// Prompt builder
// ----------------------------------------------------------------------------

function buildSystemPrompt(
  traits: { name: string; label: string; weight: number }[],
  rubricVersion: string
): string {
  const traitList = traits
    .map((t, i) => `${i + 1}. **${t.label}** (field: "${t.name}")`)
    .join("\n");

  return `You are an expert ESL/ELD writing assessor for a Canadian secondary school.
You evaluate student essays according to the Ontario ESL/ELD curriculum framework (Levels 1–5, aligned to STEP Steps 1–6).

Rubric version: ${rubricVersion}

Score each essay on the following traits on a scale of 1–5:
${traitList}

Scoring rubric per level:
  1 – Beginning: Very limited control; errors severely impede communication
  2 – Developing: Basic control; frequent errors but partial meaning is conveyed
  3 – Expanding: Adequate control; some errors; meaning is generally clear
  4 – Consolidating: Good control; occasional errors; communicates effectively
  5 – Bridging: Strong control; rare/minor errors; confident and fluent communication

Guidelines:
- Be fair but rigorous. A Level-1 student writing simple sentences well should score 3+ on Task Fulfillment.
- Consider that students may be writing in English as a second/additional language.
- The overall level is the weighted mean of trait scores rounded to the nearest integer.

Respond ONLY with a JSON object matching this exact shape — no markdown fences, no extra keys:
{
  "traits": [
    { "trait": "<traitName>", "score": <1-5>, "rationale": "<1–2 sentences>" }
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
  rubricId: string;
  itemLevel: number;
}): Promise<GradingResult> {
  // Fetch rubric from DB
  const [rubric] = await db
    .select()
    .from(rubrics)
    .where(eq(rubrics.id, params.rubricId))
    .limit(1);

  if (!rubric) {
    throw new Error(`Rubric not found: ${params.rubricId}`);
  }

  const traits = rubric.traits as { name: string; label: string; weight: number }[];
  const systemPrompt = buildSystemPrompt(traits, rubric.version);

  const userMessage =
    `Writing prompt (Level ${params.itemLevel}):\n${params.promptTextEn}\n\n` +
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
    rubricVersion: rubric.version,
  };
}
