import type { AttemptState, Flag, Level, Strand, Stream } from "./types";

/** Expected years of formal schooling for a given age (conservative floor). */
function expectedSchoolingYears(ageYears: number): number {
  // School typically starts at 6; no credit for pre-school years.
  return Math.max(0, ageYears - 6);
}

export function selectStream(
  state: AttemptState,
  perStrandLevel: Record<Strand, Level>
): { stream: Stream; flags: Flag[] } {
  const flags: Flag[] = [];
  const { intake } = state;

  const expectedYears = expectedSchoolingYears(intake.ageYears);
  const schoolingGap = expectedYears - intake.yearsOfSchooling;

  const listeningLevel = perStrandLevel["listening"];
  const readingLevel = perStrandLevel["reading"];

  const hasSchoolingGap =
    schoolingGap >= 2 && intake.l1LiteracySelfRating <= 2;
  const hasListeningReadingDelta = listeningLevel - readingLevel >= 2;

  if (hasSchoolingGap || hasListeningReadingDelta) {
    const reasons: string[] = [];
    if (hasSchoolingGap) {
      reasons.push(
        `schooling gap of ${schoolingGap} year(s) with low L1 literacy rating (${intake.l1LiteracySelfRating}/5)`
      );
    }
    if (hasListeningReadingDelta) {
      reasons.push(
        `listening level (${listeningLevel}) exceeds reading level (${readingLevel}) by 2+`
      );
    }
    flags.push({
      code: "stream-eld",
      severity: "review",
      detail: `ELD routing triggered: ${reasons.join("; ")}.`,
    });
    return { stream: "ELD", flags };
  }

  return { stream: "ESL", flags };
}
