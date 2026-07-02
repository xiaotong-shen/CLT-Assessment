/**
 * POST /api/demo/skip
 * Generates a completed assessment with randomized responses
 * and returns the final recommendation immediately.
 * For testing — lets you skip to the results screen.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { decide, advanceStrand, initialStrandProgress } from "@/engine/msat";
import type {
  AttemptState,
  Level,
  Response,
  Stage,
  Strand,
  StrandProgress,
} from "@/engine/types";

const STRANDS: Strand[] = ["reading", "listening", "grammar", "writing"];
const STAGES: Stage[] = ["route", "target", "confirm"];
const ITEMS_PER_STAGE = 4;

const BodySchema = z.object({
  /** Overall accuracy 0–1. Controls how many responses are correct. Default 0.6 */
  accuracy: z.number().min(0).max(1).optional(),
  /** Only generate results for specific strands. Default: all */
  strands: z.array(z.enum(["reading", "listening", "grammar", "writing"])).optional(),
});

function fakeResponses(
  strand: Strand,
  stage: Stage,
  levels: Level[],
  accuracy: number,
): Response[] {
  const responses: Response[] = [];
  for (let i = 0; i < ITEMS_PER_STAGE; i++) {
    const level = levels[i % levels.length] ?? (3 as Level);
    responses.push({
      itemId: `fake-${strand}-${stage}-${i}`,
      level,
      correct: Math.random() < accuracy,
      timeMs: 3000 + Math.floor(Math.random() * 7000),
      stage,
      strand,
    });
  }
  return responses;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const accuracy = parsed.data.accuracy ?? 0.6;
  const activeStrands = parsed.data.strands ?? STRANDS;
  const base = initialStrandProgress();

  let state: AttemptState = {
    attemptId: "demo-skip",
    intake: {
      l1: "zh",
      yearsOfSchooling: 10,
      l1LiteracySelfRating: 5,
      ageYears: 16,
    },
    responses: [],
    strandProgress: base,
    startedAtMs: Date.now() - 600_000, // pretend started 10 min ago
  };

  // Mark non-active strands as done
  for (const strand of STRANDS) {
    if (!activeStrands.includes(strand)) {
      state.strandProgress = {
        ...state.strandProgress,
        [strand]: { stage: "done", trackLevels: [], estimatedLevel: 3 } as StrandProgress,
      };
    }
  }

  // Walk each active strand through all 3 stages
  for (const strand of activeStrands) {
    for (const stage of STAGES) {
      const progress = state.strandProgress[strand];
      if (progress.stage === "done") break;

      const levels = progress.trackLevels.length > 0
        ? progress.trackLevels
        : [2, 3, 4] as Level[];

      const responses = fakeResponses(strand, stage, levels, accuracy);
      state = {
        ...state,
        responses: [...state.responses, ...responses],
      };

      // Advance the strand
      const newProgress = advanceStrand(strand, progress, state);
      state = {
        ...state,
        strandProgress: { ...state.strandProgress, [strand]: newProgress },
      };
    }
  }

  const decision = decide(state, Date.now());
  if (decision.kind !== "done") {
    return NextResponse.json(
      { error: "Engine did not produce a recommendation. This is a bug." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    done: true,
    recommendation: decision.recommendation,
    state,
  });
}
