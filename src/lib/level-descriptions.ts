/**
 * Plain-language placement descriptions.
 *
 * This is the single source of truth for how a strand + level is described to
 * students/teachers on the report. It is intentionally plain-English and
 * placeholder-quality — swap these strings for official Ontario ESL/ELD STEP
 * descriptors when the standards are imported.
 */
import type { Strand } from "@/engine/types";

export const STRAND_LABELS: Record<Strand, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar",
  writing: "Writing",
};

/** Short band name shown next to the level number. */
export const LEVEL_BAND: Record<number, string> = {
  1: "Beginning",
  2: "Developing",
  3: "Expanding",
  4: "Consolidating",
  5: "Bridging",
  6: "Mainstream-ready",
};

/** STEP alignment, kept separate so the band label stays short. */
export const LEVEL_STEP: Record<number, string> = {
  1: "STEP 1–2",
  2: "STEP 2–3",
  3: "STEP 3–4",
  4: "STEP 4–5",
  5: "STEP 5–6",
  6: "STEP 6",
};

/**
 * Plain "can-do" statement for a strand at a level.
 * One short sentence describing what a student at this level can typically do.
 */
export const STRAND_LEVEL_CANDO: Record<Strand, Record<number, string>> = {
  reading: {
    1: "Can read isolated words and very simple, familiar phrases.",
    2: "Can read short, simple texts and find basic information in them.",
    3: "Can read simple and some longer texts on familiar topics with general understanding.",
    4: "Can read a range of texts and understand main ideas and some detail.",
    5: "Can read most texts confidently, including some abstract or academic material.",
    6: "Reads at grade level; no additional English support needed.",
  },
  listening: {
    1: "Can understand isolated words and very simple spoken phrases.",
    2: "Can follow short, simple spoken exchanges on familiar topics.",
    3: "Can understand the main points of clear, everyday speech.",
    4: "Can follow extended speech and most classroom instruction.",
    5: "Can understand most spoken language, including some academic content.",
    6: "Understands spoken English at grade level; no additional support needed.",
  },
  grammar: {
    1: "Uses isolated words and memorized phrases with very limited structure.",
    2: "Forms simple sentences with frequent errors, but meaning often comes through.",
    3: "Uses simple and some complex sentences with generally clear meaning.",
    4: "Uses varied sentence structures with increasing accuracy.",
    5: "Controls most grammar with only occasional minor errors.",
    6: "Uses grade-level grammar accurately; no additional support needed.",
  },
  writing: {
    1: "Can write isolated words and copy simple phrases.",
    2: "Can write simple sentences on familiar topics with support.",
    3: "Can write short, connected texts with simple and some complex sentences.",
    4: "Can write clear, organized texts with varied structures.",
    5: "Can write well-organized texts, including some academic writing.",
    6: "Writes at grade level; no additional English support needed.",
  },
};

/** Full band label, e.g. "Beginning (STEP 1–2)". */
export function levelBandLabel(level: number): string {
  const band = LEVEL_BAND[level] ?? `Level ${level}`;
  const step = LEVEL_STEP[level];
  return step ? `${band} (${step})` : band;
}

/** Plain can-do description for a strand at a level. */
export function candoDescription(strand: Strand, level: number): string {
  return STRAND_LEVEL_CANDO[strand]?.[level] ?? "";
}
