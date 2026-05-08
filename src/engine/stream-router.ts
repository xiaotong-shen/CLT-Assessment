import type { AttemptState, Flag, Level, Strand } from "./types";

/**
 * Stream router — always ESL for this cohort.
 *
 * All students assessed by this platform are Chinese-L1 students with
 * strong L1 literacy. ELD routing (which targets students with interrupted
 * schooling or very low L1 literacy) has been disabled.
 *
 * If ELD routing is needed in the future, it can be re-introduced here
 * by examining intake.yearsOfSchooling and intake.l1LiteracySelfRating.
 */
export function selectStream(
  _state: AttemptState,
  _perStrandLevel: Record<Strand, Level>
): { stream: "ESL"; flags: Flag[] } {
  return { stream: "ESL", flags: [] };
}
