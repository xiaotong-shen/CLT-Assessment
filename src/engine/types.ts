// Pure types — no imports from src/server or Next.js.

export type Strand = "reading" | "listening" | "grammar" | "writing";
/** All students are assessed via ESL. ELD routing is disabled for this cohort. */
export type Stream = "ESL";
export type Stage = "route" | "target" | "confirm";

/** 1–5 = ESL/ELD course level; 6 = mainstream-ready (STEP step 6, no ESL needed) */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export type ItemFormat =
  | "mc-single"
  | "mc-multi"
  | "cloze"
  | "matching"
  | "short-answer"
  | "essay"
  | "listening-mc";

export interface ItemRef {
  id: string;
  strand: Strand;
  level: Level;
  subskill: string;
  format: ItemFormat;
}

export interface Response {
  itemId: string;
  level: Level;
  correct: boolean;
  timeMs: number;
  stage: Stage;
  strand: Strand;
}

export interface IntakeAnswers {
  l1: string;
  yearsOfSchooling: number;
  /** 1 = "I can't read in any language", 5 = "I read fluently in my L1" */
  l1LiteracySelfRating: 1 | 2 | 3 | 4 | 5;
  ageYears: number;
}

export interface StrandProgress {
  stage: Stage | "done";
  trackLevels: Level[];      // which levels this strand is targeting
  estimatedLevel: Level | null;
}

export interface AttemptState {
  attemptId: string;
  intake: IntakeAnswers;
  responses: Response[];
  strandProgress: Record<Strand, StrandProgress>;
  startedAtMs: number;
}

export interface ItemConstraints {
  strand: Strand;
  levels: Level[];
  subskills?: string[];
  excludeItemIds: string[];
}

export interface NextItemDecision {
  kind: "next-item";
  strand: Strand;
  stage: Stage;
  constraints: ItemConstraints;
}

export interface DoneDecision {
  kind: "done";
  recommendation: Recommendation;
}

export type Decision = NextItemDecision | DoneDecision;

export interface Flag {
  code: FlagCode;
  severity: "info" | "warn" | "review";
  detail: string;
}

export type FlagCode =
  | "uneven-profile"
  | "stage-3-ambiguous"
  | "rushed"
  | "rapid-clicks"
  | "writing-blank"
  | "audio-skipped";

export interface Recommendation {
  stream: Stream;
  /** Ontario course code e.g. "ESLCO" or "Mainstream" */
  course: string;
  perStrandLevel: Record<Strand, Level>;
  /** Identical to perStrandLevel in Phase 1; kept separate for Phase 2 Speaking */
  stepProfile: Partial<Record<Strand, Level>>;
  flags: Flag[];
  /** Human-readable engine trace in English */
  reasoning: string[];
  engineVersion: string;
}
