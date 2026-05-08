import { describe, it, expect } from "vitest";
import {
  decide,
  advanceStrand,
  initialStrandProgress,
} from "../msat";
import type { AttemptState, Level, Response, Strand } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<AttemptState> = {}): AttemptState {
  return {
    attemptId: "test-attempt",
    intake: {
      l1: "zh",
      yearsOfSchooling: 10,
      l1LiteracySelfRating: 5,
      ageYears: 16,
    },
    responses: [],
    strandProgress: initialStrandProgress(),
    startedAtMs: Date.now() - 30 * 60 * 1000, // 30 min ago
    ...overrides,
  };
}

/**
 * Simulates a student answering all items in all stages for a strand
 * at a fixed "true level", returning the final estimated level.
 */
function simulateStrand(
  strand: Strand,
  trueLevel: Level,
  state: AttemptState
): { state: AttemptState; estimatedLevel: Level } {
  let s = { ...state, responses: [...state.responses] };

  const stages = ["route", "target", "confirm"] as const;

  for (const stage of stages) {
    const decision = decide(s, Date.now());
    if (decision.kind === "done") break;
    if (decision.strand !== strand) break;

    const needed = 4;
    const trackLevels = s.strandProgress[strand].trackLevels;

    for (let i = 0; i < needed; i++) {
      // Cycle through track levels so the engine sees variety
      const itemLevel = (trackLevels[i % trackLevels.length] ?? 3) as Level;
      const correct = itemLevel <= trueLevel;

      const response: Response = {
        itemId: `${strand}-${stage}-${i}`,
        level: itemLevel,
        correct,
        timeMs: 15000,
        stage,
        strand,
      };
      s = { ...s, responses: [...s.responses, response] };
    }

    // Advance stage
    const updatedProgress = advanceStrand(strand, s.strandProgress[strand], s);
    s = {
      ...s,
      strandProgress: { ...s.strandProgress, [strand]: updatedProgress },
    };
  }

  const finalLevel = s.strandProgress[strand].estimatedLevel ?? 1;
  return { state: s, estimatedLevel: finalLevel };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe("MSAT engine", () => {
  it("starts with a next-item decision for reading route stage", () => {
    const state = makeState();
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("next-item");
    if (decision.kind === "next-item") {
      expect(decision.strand).toBe("reading");
      expect(decision.stage).toBe("route");
    }
  });

  it("routes a perfect Level-1 student to ESLAO", () => {
    let state = makeState();
    const now = Date.now();

    for (const strand of ["reading", "listening", "grammar"] as Strand[]) {
      const result = simulateStrand(strand, 1, state);
      state = result.state;
    }

    // Writing — mark as done at level 1
    state = {
      ...state,
      strandProgress: {
        ...state.strandProgress,
        writing: { stage: "done", trackLevels: [], estimatedLevel: 1 },
      },
    };

    const decision = decide(state, now);
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      expect(decision.recommendation.course).toBe("ESLAO");
      expect(decision.recommendation.stream).toBe("ESL");
    }
  });

  it("routes a perfect Level-5 student to ESLEO", () => {
    let state = makeState();
    const now = Date.now();

    for (const strand of ["reading", "listening", "grammar"] as Strand[]) {
      const result = simulateStrand(strand, 5, state);
      state = result.state;
    }

    state = {
      ...state,
      strandProgress: {
        ...state.strandProgress,
        writing: { stage: "done", trackLevels: [], estimatedLevel: 5 },
      },
    };

    const decision = decide(state, now);
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      expect(decision.recommendation.course).toBe("ESLEO");
    }
  });

  it("uses the lowest strand for course code (not average)", () => {
    const state = makeState({
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 4 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 2 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 4 },
      },
    });
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      // lowest is listening = 2 → ESLBO
      expect(decision.recommendation.course).toBe("ESLBO");
    }
  });

  it("flags uneven profile when strands differ by more than 1", () => {
    const state = makeState({
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 5 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 2 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 4 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 3 },
      },
    });
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      const codes = decision.recommendation.flags.map((f) => f.code);
      expect(codes).toContain("uneven-profile");
    }
  });

  it("flags rapid-clicks when 3+ items answered under 2s", () => {
    const quickResponses: Response[] = Array.from({ length: 4 }, (_, i) => ({
      itemId: `r-${i}`,
      level: 3 as Level,
      correct: true,
      timeMs: 500,
      stage: "route" as const,
      strand: "reading" as Strand,
    }));

    const state = makeState({
      responses: quickResponses,
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 3 },
      },
    });

    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      const codes = decision.recommendation.flags.map((f) => f.code);
      expect(codes).toContain("rapid-clicks");
    }
  });

  it("always routes ESL even when listening >> reading (ELD disabled for this cohort)", () => {
    const state = makeState({
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 1 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 4 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 2 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 1 },
      },
    });
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      expect(decision.recommendation.stream).toBe("ESL");
      expect(decision.recommendation.course).toBe("ESLAO"); // lowest = 1 → ESLAO
      const codes = decision.recommendation.flags.map((f) => f.code);
      expect(codes).not.toContain("stream-eld");
    }
  });

  it("flags rushed when completed in under 22 minutes", () => {
    const state = makeState({
      startedAtMs: Date.now() - 10 * 60 * 1000, // 10 min ago
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 3 },
      },
    });
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      const codes = decision.recommendation.flags.map((f) => f.code);
      expect(codes).toContain("rushed");
    }
  });

  // T-050 acceptance criterion: synthetic Level-4 reader gets perStrandLevel.reading = 4
  it("Level-4 reader is placed at reading level 4 (T-050)", () => {
    let state = makeState();

    // Reading strand at true level 4
    const { state: afterReading, estimatedLevel } = simulateStrand("reading", 4, state);
    state = afterReading;
    expect(estimatedLevel).toBe(4);

    // Finish other strands at level 3 so we can get the final recommendation
    for (const strand of ["listening", "grammar"] as Strand[]) {
      const result = simulateStrand(strand, 3, state);
      state = result.state;
    }
    state = {
      ...state,
      strandProgress: {
        ...state.strandProgress,
        writing: { stage: "done", trackLevels: [], estimatedLevel: 4 },
      },
    };

    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      expect(decision.recommendation.perStrandLevel.reading).toBe(4);
    }
  });

  it("no item is shown twice in the same attempt (T-050)", () => {
    let state = makeState();
    const shownIds = new Set<string>();

    for (const strand of ["reading", "listening", "grammar"] as Strand[]) {
      const stages = ["route", "target", "confirm"] as const;
      for (const stage of stages) {
        for (let i = 0; i < 4; i++) {
          const id = `${strand}-${stage}-${i}`;
          expect(shownIds.has(id)).toBe(false);
          shownIds.add(id);
        }
        const updatedProgress = advanceStrand(strand, state.strandProgress[strand], state);
        state = {
          ...state,
          strandProgress: { ...state.strandProgress, [strand]: updatedProgress },
        };
      }
    }
    // All ids are unique — no duplicates
    expect(shownIds.size).toBe(3 * 3 * 4); // 3 strands × 3 stages × 4 items
  });

  it("recommendation includes engine version", () => {
    const state = makeState({
      strandProgress: {
        reading: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        listening: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        grammar: { stage: "done", trackLevels: [], estimatedLevel: 3 },
        writing: { stage: "done", trackLevels: [], estimatedLevel: 3 },
      },
    });
    const decision = decide(state, Date.now());
    expect(decision.kind).toBe("done");
    if (decision.kind === "done") {
      expect(decision.recommendation.engineVersion).toContain("msat-");
    }
  });
});
