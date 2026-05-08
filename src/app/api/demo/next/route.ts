/**
 * Stateless demo endpoint — no DB writes.
 *
 * POST /api/demo/next
 * Body: { state: AttemptState, response?: {...}, strandFilter?: Strand }
 * Returns: { item, stage, strand, state, explain } | { done: true, recommendation, explain }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { items } from "../../../../../db/schema";
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
  correct: z.boolean(),
  timeMs: z.number(),
  stage: z.string(),
  strand: z.string(),
  level: z.number(),
});

const BodySchema = z.object({
  state: z.custom<AttemptState>(),
  response: ResponseSchema.optional(),
  strandFilter: z
    .enum(["reading", "listening", "grammar", "writing"])
    .optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let state: AttemptState = parsed.data.state;
  const incoming = parsed.data.response;

  // Apply the response to state if provided
  if (incoming) {
    const newResponse: Response = {
      itemId: incoming.itemId,
      correct: incoming.correct,
      timeMs: incoming.timeMs,
      stage: incoming.stage as Stage,
      strand: incoming.strand as Strand,
      level: incoming.level as Level,
    };

    const updatedResponses = [...state.responses, newResponse];

    // Check if the strand stage is complete (every 4 responses in this stage)
    const strandResponses = updatedResponses.filter(
      (r) => r.strand === incoming.strand && r.stage === incoming.stage
    );

    let updatedProgress = { ...state.strandProgress };
    if (strandResponses.length >= 4) {
      const newProgress = advanceStrand(
        incoming.strand as Strand,
        state.strandProgress[incoming.strand as Strand],
        { ...state, responses: updatedResponses }
      );
      updatedProgress = { ...updatedProgress, [incoming.strand]: newProgress };
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
    });
  }

  const { constraints, stage, strand } = decision;
  const alreadyShown = state.responses.map((r) => r.itemId);

  const candidates = await db
    .select()
    .from(items)
    .where(and(eq(items.strand, strand), eq(items.status, "live")));

  const filtered = candidates.filter(
    (item) =>
      constraints.levels.includes(item.level as Level) &&
      !alreadyShown.includes(item.id)
  );

  if (filtered.length === 0) {
    return NextResponse.json(
      { error: `No live items available for ${strand} at levels [${constraints.levels.join(",")}]` },
      { status: 500 }
    );
  }

  const picked = filtered.sort((a, b) => a.nAttempts - b.nAttempts)[0]!;

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
  });
}
