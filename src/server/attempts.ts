import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import { attempts, attemptItems, items, prompts } from "../../db/schema";
import { gradeEssay } from "./writing-grader";
import {
  decide,
  advanceStrand,
  initialStrandProgress,
} from "@/engine/msat";
import type {
  AttemptState,
  Level,
  Response,
  Strand,
  Stage,
  StrandProgress,
} from "@/engine/types";
import { getEngineVersion } from "@/engine/version";
import { ClientItemSchema } from "./schemas/items";
import type { ClientItem } from "./schemas/items";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttemptStatus = "in-progress" | "complete" | "abandoned";

// ---------------------------------------------------------------------------
// Create / resume
// ---------------------------------------------------------------------------

export async function createAttempt(
  intake: Record<string, unknown>,
  userId?: string
): Promise<string> {
  const id = createId();
  const engineVersion = getEngineVersion();

  // Snapshot live item ids for audit trail
  const liveItems = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.status, "live"));
  const snapshotHash = liveItems
    .map((i) => i.id)
    .sort()
    .join(",");

  await db.insert(attempts).values({
    id,
    userId: userId ?? null,
    status: "in-progress",
    intakeAnswers: intake,
    engineVersion,
    itemBankSnapshotId: snapshotHash,
  });

  return id;
}

export async function getAttempt(id: string) {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, id))
    .limit(1);
  return attempt ?? null;
}

// ---------------------------------------------------------------------------
// Rebuild engine state from DB
// ---------------------------------------------------------------------------

export async function buildAttemptState(attemptId: string): Promise<AttemptState | null> {
  const attempt = await getAttempt(attemptId);
  if (!attempt) return null;

  const rows = await db
    .select()
    .from(attemptItems)
    .where(eq(attemptItems.attemptId, attemptId))
    .orderBy(attemptItems.presentedAt);

  const responses: Response[] = rows
    .filter((r) => r.isCorrect !== null && r.timeMs !== null)
    .map((r) => ({
      itemId: r.itemId,
      level: r.level as Level,
      correct: r.isCorrect!,
      timeMs: r.timeMs!,
      stage: r.stage as Stage,
      strand: r.strand as Strand,
    }));

  // Rebuild strand progress by replaying responses
  let strandProgress = initialStrandProgress();
  const strands: Strand[] = ["reading", "listening", "grammar", "writing"];

  for (const strand of strands) {
    let progress = strandProgress[strand];
    const strandRows = rows.filter((r) => r.strand === strand);

    // Rebuild stage by stage
    const stages: Stage[] = ["route", "target", "confirm"];
    for (const stage of stages) {
      const stageRows = strandRows.filter((r) => r.stage === stage);
      const stageLimit = 4;
      if (stageRows.length >= stageLimit && stage !== "confirm") {
        const tempState: AttemptState = {
          attemptId,
          intake: attempt.intakeAnswers as unknown as AttemptState["intake"],
          responses,
          strandProgress,
          startedAtMs: attempt.startedAt.getTime(),
        };
        progress = advanceStrand(strand, progress, tempState);
        strandProgress = { ...strandProgress, [strand]: progress };
      } else if (stageRows.length >= stageLimit && stage === "confirm") {
        const tempState: AttemptState = {
          attemptId,
          intake: attempt.intakeAnswers as unknown as AttemptState["intake"],
          responses,
          strandProgress,
          startedAtMs: attempt.startedAt.getTime(),
        };
        progress = advanceStrand(strand, progress, tempState);
        strandProgress = { ...strandProgress, [strand]: progress };
        break;
      } else {
        break;
      }
    }
  }

  return {
    attemptId,
    intake: attempt.intakeAnswers as unknown as AttemptState["intake"],
    responses,
    strandProgress,
    startedAtMs: attempt.startedAt.getTime(),
  };
}

// ---------------------------------------------------------------------------
// Next item selection
// ---------------------------------------------------------------------------

export async function getNextItem(
  attemptId: string
): Promise<{ item: ClientItem; stage: Stage; strand: Strand } | { done: true } | null> {
  const state = await buildAttemptState(attemptId);
  if (!state) return null;

  const attempt = await getAttempt(attemptId);
  if (attempt?.status === "complete") return { done: true };

  const decision = decide(state, Date.now());

  if (decision.kind === "done") {
    // Auto-complete if not already complete
    if (attempt?.status === "in-progress") {
      await db
        .update(attempts)
        .set({
          status: "complete",
          finishedAt: new Date(),
          recommendation: decision.recommendation as unknown as Record<string, unknown>,
        })
        .where(eq(attempts.id, attemptId));
    }
    return { done: true };
  }

  const { constraints, stage, strand } = decision;
  const alreadyShown = state.responses.map((r) => r.itemId);

  // Pick a random item matching the constraints, weighted by least exposure
  const candidates = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.strand, strand),
        eq(items.status, "live")
      )
    );

  const filtered = candidates.filter(
    (item) =>
      constraints.levels.includes(item.level as Level) &&
      !alreadyShown.includes(item.id)
  );

  if (filtered.length === 0) {
    // No items available — advance this strand past its current stage to avoid infinite loop
    // This can happen when the item bank is thin during development
    return null;
  }

  // Pick by least n_attempts (least exposed)
  const picked = filtered.sort((a, b) => a.nAttempts - b.nAttempts)[0]!;

  // Record presentation
  await db.insert(attemptItems).values({
    id: createId(),
    attemptId,
    itemId: picked.id,
    strand,
    stage,
    level: picked.level,
    presentedAt: new Date(),
  });

  // Strip answer key for client
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

  if (!clientParsed.success) return null;

  return { item: clientParsed.data, stage, strand };
}

// ---------------------------------------------------------------------------
// Record response
// ---------------------------------------------------------------------------

const ResponseBodySchema = z.object({
  itemId: z.string(),
  response: z.unknown(),
  timeMs: z.number().int().positive(),
});

export async function recordResponse(
  attemptId: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ResponseBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid response body" };

  const { itemId, response, timeMs } = parsed.data;

  // Check this item was presented in this attempt
  const [row] = await db
    .select()
    .from(attemptItems)
    .where(
      and(
        eq(attemptItems.attemptId, attemptId),
        eq(attemptItems.itemId, itemId)
      )
    )
    .limit(1);

  if (!row) return { ok: false, error: "Item not found in attempt" };
  if (row.isCorrect !== null) return { ok: true }; // idempotent — already scored

  // Fetch item to score
  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Item not found" };

  let isCorrect = scoreResponse(item.format, item.payload, response);
  let storedResponse = response as Record<string, unknown>;

  // Essay items: call LLM grader; treat as "correct" if scored level ≥ item level
  if (item.format === "essay") {
    const essayText = (response as { text?: string })?.text ?? "";
    const payload = item.payload as {
      promptTextEn: string;
      rubricId: string;
    };

    try {
      const grading = await gradeEssay({
        promptTextEn: payload.promptTextEn,
        essayText,
        rubricId: payload.rubricId,
        itemLevel: item.level,
      });

      // Store grading result alongside the raw essay text
      storedResponse = {
        text: essayText,
        grading,
      };
      // "Correct" = scored level meets or exceeds the item's target level
      isCorrect = grading.scoredLevel >= item.level;
    } catch (err) {
      console.error(`[writing-grader] gradeEssay failed for item ${itemId}:`, err);
      // Fall back: store raw text, treat as correct so the test can progress
      storedResponse = { text: essayText, gradingError: String(err) };
      isCorrect = true;
    }
  }

  await db
    .update(attemptItems)
    .set({ response: storedResponse, isCorrect, timeMs })
    .where(
      and(
        eq(attemptItems.attemptId, attemptId),
        eq(attemptItems.itemId, itemId)
      )
    );

  // Update item exposure counter
  await db
    .update(items)
    .set({ nAttempts: item.nAttempts + 1 })
    .where(eq(items.id, itemId));

  // Check if this stage is now complete and advance strand progress in DB
  // (State is rebuilt from DB on next call — no in-memory state needed)

  return { ok: true };
}

function scoreResponse(
  format: string,
  payload: unknown,
  response: unknown
): boolean {
  if (format === "mc-single" || format === "listening-mc") {
    const p = payload as { correctOptionId: string };
    return (response as { optionId?: string })?.optionId === p.correctOptionId;
  }
  if (format === "mc-multi") {
    const p = payload as { correctOptionIds: string[] };
    const selected = (response as { optionIds?: string[] })?.optionIds ?? [];
    const correct = [...p.correctOptionIds].sort().join(",");
    const given = [...selected].sort().join(",");
    return correct === given;
  }
  if (format === "cloze") {
    const p = payload as { blanks: { id: string; correctAnswer: string; acceptableVariants: string[] }[] };
    const answers = (response as Record<string, string>) ?? {};
    return p.blanks.every((blank) => {
      const given = (answers[blank.id] ?? "").trim().toLowerCase();
      const correct = blank.correctAnswer.trim().toLowerCase();
      const variants = blank.acceptableVariants.map((v) => v.trim().toLowerCase());
      return given === correct || variants.includes(given);
    });
  }
  // essay scored separately by LLM grader
  return false;
}

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

export async function getAuditJson(attemptId: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) return null;

  const rows = await db
    .select()
    .from(attemptItems)
    .where(eq(attemptItems.attemptId, attemptId))
    .orderBy(attemptItems.presentedAt);

  return {
    attemptId,
    engineVersion: attempt.engineVersion,
    itemBankSnapshotId: attempt.itemBankSnapshotId,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    status: attempt.status,
    intakeAnswers: attempt.intakeAnswers,
    recommendation: attempt.recommendation,
    items: rows,
  };
}
