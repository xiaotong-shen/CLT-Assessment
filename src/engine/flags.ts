import type { AttemptState, Flag, Level, Strand } from "./types";

const EXPECTED_TOTAL_MS = 45 * 60 * 1000; // 45 minutes

export function computeFlags(
  state: AttemptState,
  perStrandLevel: Record<Strand, Level>,
  stream: "ESL" | "ELD",
  nowMs: number
): Flag[] {
  const flags: Flag[] = [];

  // Uneven profile: max strand level differs from min by more than 1
  const levels = Object.values(perStrandLevel) as Level[];
  const max = Math.max(...levels) as Level;
  const min = Math.min(...levels) as Level;
  if (max - min > 1) {
    flags.push({
      code: "uneven-profile",
      severity: "review",
      detail: `Strand levels span ${min}–${max}. Student profile is uneven.`,
    });
  }

  // ELD routing always flagged
  if (stream === "ELD") {
    flags.push({
      code: "stream-eld",
      severity: "review",
      detail: "Student routed to ELD stream. Specialist review required.",
    });
  }

  // Rushed: total elapsed < 50% of expected
  const elapsedMs = nowMs - state.startedAtMs;
  if (elapsedMs < EXPECTED_TOTAL_MS * 0.5) {
    flags.push({
      code: "rushed",
      severity: "warn",
      detail: `Completed in ${Math.round(elapsedMs / 60000)} min (expected ~45 min).`,
    });
  }

  // Rapid-clicking: 3+ items answered in < 2 seconds
  const rapidItems = state.responses.filter((r) => r.timeMs < 2000);
  if (rapidItems.length >= 3) {
    flags.push({
      code: "rapid-clicks",
      severity: "review",
      detail: `${rapidItems.length} items answered in under 2 seconds.`,
    });
  }

  // Writing blank: writing prompt response missing at level >= 3
  // (checked separately in the writing grader; placeholder here)

  return flags;
}
