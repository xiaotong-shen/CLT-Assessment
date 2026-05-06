/**
 * Multi-Stage Adaptive Test (MSAT) engine.
 * Pure functions — no DB, no fetch, no Date.now().
 * Per IMPLEMENTATION.md §3.2.
 */
import type {
  AttemptState,
  Decision,
  Level,
  Recommendation,
  Stage,
  Strand,
  StrandProgress,
} from "./types";
import { selectStream } from "./stream-router";
import { mapToCourse } from "./course-mapper";
import { computeFlags } from "./flags";
import { getEngineVersion } from "./version";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRANDS: Strand[] = ["reading", "listening", "grammar", "writing"];

const ITEMS_PER_STAGE: Record<Stage, number> = {
  route: 4,
  target: 4,
  confirm: 4, // 2 at level-1, 2 at level+1
};

// Route stage always uses these mid-difficulty levels
const ROUTE_LEVELS: Level[] = [2, 3, 4];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function responsesForStrandAndStage(
  state: AttemptState,
  strand: Strand,
  stage: Stage
): AttemptState["responses"] {
  return state.responses.filter(
    (r) => r.strand === strand && r.stage === stage
  );
}

/**
 * Accuracy at a given level or below.
 * Returns null if no responses exist at that range.
 */
function accuracyAtOrBelow(
  responses: AttemptState["responses"],
  maxLevel: Level
): number | null {
  const relevant = responses.filter((r) => r.level <= maxLevel);
  if (relevant.length === 0) return null;
  const correct = relevant.filter((r) => r.correct).length;
  return correct / relevant.length;
}

/**
 * Estimate the level from a set of responses using the §5.3 rule:
 * max d such that accuracy_at_d_or_below >= 0.7 AND accuracy_at_d+1 < 0.5
 * Conservative: defaults to the lowest presented level on ambiguity.
 */
function estimateLevel(responses: AttemptState["responses"]): Level {
  const presentedLevels = [
    ...new Set(responses.map((r) => r.level)),
  ].sort() as Level[];

  if (presentedLevels.length === 0) return 1;

  let best: Level = presentedLevels[0] ?? 1;

  for (const level of presentedLevels) {
    const atOrBelow = accuracyAtOrBelow(responses, level);
    const nextLevel = (level + 1) as Level;
    const atNext = accuracyAtOrBelow(responses, nextLevel);

    if (atOrBelow !== null && atOrBelow >= 0.7) {
      if (atNext === null || atNext < 0.5) {
        best = level;
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

function nextTrackForRoute(
  routeResponses: AttemptState["responses"]
): Level[] {
  if (routeResponses.length === 0) return ROUTE_LEVELS;
  const correct = routeResponses.filter((r) => r.correct).length;
  const accuracy = correct / routeResponses.length;
  if (accuracy >= 0.75) return [4, 5];
  if (accuracy <= 0.25) return [1, 2];
  return [2, 3, 4];
}

function confirmLevels(estimatedLevel: Level): Level[] {
  const lower = Math.max(1, estimatedLevel - 1) as Level;
  const upper = Math.min(6, estimatedLevel + 1) as Level;
  return [lower, upper] as Level[];
}

/**
 * Given confirm responses, adjust the estimate up or down.
 * Flags ambiguity if the confirm didn't move the estimate.
 */
function applyConfirm(
  estimated: Level,
  confirmResponses: AttemptState["responses"]
): { finalLevel: Level; ambiguous: boolean } {
  const lower = Math.max(1, estimated - 1) as Level;
  const upper = Math.min(6, estimated + 1) as Level;

  const lowerResponses = confirmResponses.filter((r) => r.level === lower);
  const upperResponses = confirmResponses.filter((r) => r.level === upper);

  const lowerAcc =
    lowerResponses.length > 0
      ? lowerResponses.filter((r) => r.correct).length / lowerResponses.length
      : null;
  const upperAcc =
    upperResponses.length > 0
      ? upperResponses.filter((r) => r.correct).length / upperResponses.length
      : null;

  // Bump up: upper items >= 50% AND lower items 100%
  if (upperAcc !== null && upperAcc >= 0.5 && lowerAcc === 1.0) {
    return { finalLevel: upper, ambiguous: false };
  }
  // Bump down: lower items < 100%
  if (lowerAcc !== null && lowerAcc < 1.0) {
    return { finalLevel: lower, ambiguous: false };
  }
  // Ambiguous: estimate unchanged
  const ambiguous =
    upperAcc !== null && upperAcc >= 0.5 && lowerAcc !== null && lowerAcc < 1.0
      ? false
      : true;
  return { finalLevel: estimated, ambiguous };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given the current attempt state, decide what happens next.
 * Returns either a NextItemDecision (pick an item matching constraints)
 * or a DoneDecision (all strands finished, recommendation ready).
 */
export function decide(
  state: AttemptState,
  nowMs: number
): Decision {
  // Find the first strand that isn't done yet
  for (const strand of STRANDS) {
    const progress = state.strandProgress[strand];

    if (progress.stage === "done") continue;

    const stageResponses = responsesForStrandAndStage(
      state,
      strand,
      progress.stage
    );
    const itemsNeeded = ITEMS_PER_STAGE[progress.stage];

    if (stageResponses.length < itemsNeeded) {
      // Still need more items in this stage
      return {
        kind: "next-item",
        strand,
        stage: progress.stage,
        constraints: {
          strand,
          levels: progress.trackLevels,
          excludeItemIds: state.responses.map((r) => r.itemId),
        },
      };
    }

    // Stage complete — advance
    // (decide() is called again after state is updated externally)
  }

  // All strands done — produce recommendation
  return buildRecommendation(state, nowMs);
}

/**
 * Called externally when a stage's item quota is filled to advance state.
 * Returns the updated StrandProgress for the given strand.
 */
export function advanceStrand(
  strand: Strand,
  progress: StrandProgress,
  state: AttemptState
): StrandProgress {
  const allResponses = state.responses.filter((r) => r.strand === strand);
  const stageResponses = allResponses.filter((r) => r.stage === progress.stage);

  if (progress.stage === "route") {
    const trackLevels = nextTrackForRoute(stageResponses);
    return { stage: "target", trackLevels, estimatedLevel: null };
  }

  if (progress.stage === "target") {
    const estimated = estimateLevel(stageResponses);
    const levels = confirmLevels(estimated);
    return { stage: "confirm", trackLevels: levels, estimatedLevel: estimated };
  }

  if (progress.stage === "confirm") {
    const targetResponses = allResponses.filter((r) => r.stage === "target");
    const estimated = progress.estimatedLevel ?? estimateLevel(targetResponses);
    const { finalLevel } = applyConfirm(estimated, stageResponses);
    return {
      stage: "done",
      trackLevels: [],
      estimatedLevel: finalLevel,
    };
  }

  return progress; // already done
}

function buildRecommendation(
  state: AttemptState,
  nowMs: number
): Decision {
  const perStrandLevel = {} as Record<Strand, Level>;

  for (const strand of STRANDS) {
    const progress = state.strandProgress[strand];
    perStrandLevel[strand] = progress.estimatedLevel ?? 1;
  }

  const { stream, flags: streamFlags } = selectStream(state, perStrandLevel);

  const lowestLevel = Math.min(...Object.values(perStrandLevel)) as Level;
  const course = mapToCourse(stream, lowestLevel);

  const runtimeFlags = computeFlags(state, perStrandLevel, stream, nowMs);
  const allFlags = [...streamFlags, ...runtimeFlags];

  const reasoning = buildReasoning(state, perStrandLevel, stream, course);

  const recommendation: Recommendation = {
    stream,
    course,
    perStrandLevel,
    stepProfile: { ...perStrandLevel },
    flags: allFlags,
    reasoning,
    engineVersion: getEngineVersion(),
  };

  return { kind: "done", recommendation };
}

function buildReasoning(
  state: AttemptState,
  perStrandLevel: Record<Strand, Level>,
  stream: "ESL" | "ELD",
  course: string
): string[] {
  const lines: string[] = [];

  for (const strand of STRANDS) {
    const progress = state.strandProgress[strand];
    const level = perStrandLevel[strand];
    lines.push(
      `${strand}: route→${progress.trackLevels.join("/")}→ estimated level ${level}`
    );
  }

  lines.push(`Stream selected: ${stream}`);
  lines.push(`Lowest strand level: ${Math.min(...Object.values(perStrandLevel))}`);
  lines.push(`Recommended course: ${course}`);

  return lines;
}

/**
 * Initialize blank strand progress for a new attempt.
 */
export function initialStrandProgress(): Record<Strand, StrandProgress> {
  return {
    reading: { stage: "route", trackLevels: ROUTE_LEVELS, estimatedLevel: null },
    listening: { stage: "route", trackLevels: ROUTE_LEVELS, estimatedLevel: null },
    grammar: { stage: "route", trackLevels: ROUTE_LEVELS, estimatedLevel: null },
    writing: { stage: "route", trackLevels: [1, 2, 3, 4, 5], estimatedLevel: null },
  };
}
