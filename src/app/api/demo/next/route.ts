/**
 * Stateless demo endpoint — no DB at all.
 *
 * POST /api/demo/next
 * Body: { state, response?: { itemId, raw, timeMs, stage, strand, level } }
 *   `raw` is the raw user response (string for mc-single, string[] for mc-multi/cloze, etc.)
 *   Items come from the static seed bank (src/server/item-bank.ts); the server
 *   scores correctness against the full item payload.
 * Returns: { item, stage, strand, state, explain, lastCorrect? } | { done, recommendation, explain, lastCorrect? }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getItemById, getLiveItems } from "@/server/item-bank";
import {
  gradeEssay,
  isGraderConfigured,
  type GradingResult,
} from "@/server/writing-grader";
import {
  decide,
  advanceStrand,
  explainDecision,
} from "@/engine/msat";
import { ClientItemSchema } from "@/server/schemas/items";
import type {
  AttemptState,
  Level,
  Response,
  Stage,
  Strand,
} from "@/engine/types";

const ResponseSchema = z.object({
  itemId: z.string(),
  raw: z.unknown(),
  timeMs: z.number(),
  stage: z.string(),
  strand: z.string(),
  level: z.number(),
});

const BodySchema = z.object({
  state: z.custom<AttemptState>(),
  response: ResponseSchema.optional(),
});

// ---------------------------------------------------------------------------
// Server-side correctness scoring.
// Has access to the full item payload (including correctOptionId etc.).
// ---------------------------------------------------------------------------
function scoreResponse(
  format: string,
  payload: Record<string, unknown>,
  raw: unknown
): boolean {
  // mc-single & listening-mc submit { optionId: string }
  if (format === "mc-single" || format === "listening-mc") {
    const picked = (raw as { optionId?: string } | null)?.optionId;
    return picked === payload["correctOptionId"];
  }

  // mc-multi submits { optionIds: string[] }
  if (format === "mc-multi") {
    const correctIds = (payload["correctOptionIds"] as string[]) ?? [];
    const picked = (raw as { optionIds?: string[] } | null)?.optionIds ?? [];
    return (
      correctIds.length === picked.length &&
      correctIds.every((id) => picked.includes(id))
    );
  }

  // cloze submits Record<blankId, string>; payload.blanks: [{ id, correctAnswer }]
  if (format === "cloze") {
    const blanks = (payload["blanks"] as
      | { id: string; correctAnswer: string }[]
      | undefined) ?? [];
    const answers = (raw as Record<string, string> | null) ?? {};
    if (blanks.length === 0) return false;
    return blanks.every(
      (b) =>
        b.correctAnswer.trim().toLowerCase() ===
        (answers[b.id] ?? "").trim().toLowerCase()
    );
  }

  // Essays always advance the engine in demo mode
  if (format === "essay") return true;

  return true;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let state: AttemptState = parsed.data.state;
  const incoming = parsed.data.response;
  let lastCorrect: boolean | undefined;
  let writingGrading: GradingResult | null = null;

  // Apply the response — score on the server using the full item payload.
  if (incoming) {
    const row = getItemById(incoming.itemId);

    if (!row) {
      return NextResponse.json(
        { error: `Item not found: ${incoming.itemId}` },
        { status: 400 }
      );
    }

    const correct = scoreResponse(
      row.format,
      row.payload as Record<string, unknown>,
      incoming.raw
    );
    lastCorrect = correct;

    const newResponse: Response = {
      itemId: incoming.itemId,
      correct,
      timeMs: incoming.timeMs,
      stage: incoming.stage as Stage,
      strand: incoming.strand as Strand,
      level: incoming.level as Level,
    };

    const updatedResponses = [...state.responses, newResponse];
    const strandResponses = updatedResponses.filter(
      (r) => r.strand === incoming.strand && r.stage === incoming.stage
    );

    let updatedProgress = { ...state.strandProgress };
    if (incoming.strand === "writing") {
      // Writing is a single prompt: the student writes one essay and the strand
      // is complete. The level comes from grading the essay with the Claude
      // writing-grader. If no API key is configured, fall back to a provisional
      // mid-level placeholder (level 3) so the demo still completes.
      const essayText =
        (incoming.raw as { text?: string } | null)?.text?.trim() ?? "";
      const promptTextEn =
        (row.payload as Record<string, unknown>)["promptTextEn"] as
          | string
          | undefined ?? "";
      let writingLevel: Level = 3;
      if (isGraderConfigured() && essayText.length > 0) {
        try {
          writingGrading = await gradeEssay({
            promptTextEn,
            essayText,
            itemLevel: incoming.level,
          });
          writingLevel = writingGrading.scoredLevel as Level;
        } catch (err) {
          console.error("Writing grading failed; using placeholder:", err);
        }
      }
      updatedProgress = {
        ...updatedProgress,
        writing: { stage: "done", trackLevels: [], estimatedLevel: writingLevel },
      };
    } else if (strandResponses.length >= 4) {
      const newProgress = advanceStrand(
        incoming.strand as Strand,
        state.strandProgress[incoming.strand as Strand],
        { ...state, responses: updatedResponses }
      );
      updatedProgress = {
        ...updatedProgress,
        [incoming.strand]: newProgress,
      };
    }

    state = {
      ...state,
      responses: updatedResponses,
      strandProgress: updatedProgress,
    };
  }

  const decision = decide(state, Date.now());
  const explain = explainDecision(state, decision);

  if (decision.kind === "done") {
    return NextResponse.json({
      done: true,
      recommendation: decision.recommendation,
      explain,
      lastCorrect,
      writingGrading,
    });
  }

  const { constraints, stage, strand } = decision;
  const alreadyShown = state.responses.map((r) => r.itemId);

  const candidates = getLiveItems(strand);
  const unseen = candidates.filter((item) => !alreadyShown.includes(item.id));
  const target = constraints.levels[0] ?? 3;
  const nearest = (a: { level: number }, b: { level: number }) =>
    Math.abs(a.level - target) - Math.abs(b.level - target);

  // Prefer an unseen item at one of the target levels…
  const onTarget = unseen.filter((item) =>
    constraints.levels.includes(item.level as Level)
  );
  // …then the nearest unseen level (thin banks won't dead-end)…
  const fallback = [...unseen].sort(nearest);
  // …and as a last resort (bank fully exhausted, e.g. writing's few prompts),
  // reuse the nearest already-seen item rather than erroring.
  const lastResort = [...candidates].sort(nearest);

  const picked = onTarget[0] ?? fallback[0] ?? lastResort[0];

  if (!picked) {
    return NextResponse.json(
      {
        error: `No live items available for ${strand} at levels [${constraints.levels.join(",")}]`,
      },
      { status: 500 }
    );
  }

  const clientParsed = ClientItemSchema.safeParse({
    id: picked.id,
    strand: picked.strand,
    level: picked.level,
    subskill: picked.subskill,
    format: picked.format,
    status: picked.status,
    culturalContextFlag: picked.culturalContextFlag,
    estimatedTimeSec: picked.estimatedTimeSec,
    payload: picked.payload,
  });

  if (!clientParsed.success) {
    return NextResponse.json({ error: "Item schema error" }, { status: 500 });
  }

  return NextResponse.json({
    item: clientParsed.data,
    stage,
    strand,
    state,
    explain,
    lastCorrect,
    writingGrading,
  });
}
