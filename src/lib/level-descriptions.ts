/**
 * Plain-language placement descriptions, grounded in the Ontario secondary
 * ESL program (English as a Second Language — for students with age-appropriate
 * first-language literacy). The five ESL levels map to course codes and to the
 * engine's per-strand levels 1–6:
 *
 *   1 → ESLAO   2 → ESLBO   3 → ESLCO   4 → ESLDO   5 → ESLEO   6 → Mainstream
 *
 * Level 6 means the student is ready for mainstream courses with no ESL support.
 * Descriptions summarize the Ontario ESL curriculum expectations per strand.
 * Full expectations and citation: docs/esl-standards.md
 */
import type { Strand } from "@/engine/types";

export const STRAND_LABELS: Record<Strand, string> = {
  reading: "Reading",
  listening: "Listening & Speaking",
  grammar: "Grammar",
  writing: "Writing",
};

/** Ontario ESL course code for each level (level 6 = no ESL course). */
export const LEVEL_COURSE: Record<number, string> = {
  1: "ESLAO",
  2: "ESLBO",
  3: "ESLCO",
  4: "ESLDO",
  5: "ESLEO",
  6: "Mainstream",
};

/** Short band name for each level. */
export const LEVEL_BAND: Record<number, string> = {
  1: "Beginning",
  2: "Developing",
  3: "Expanding",
  4: "Consolidating",
  5: "Transitioning",
  6: "Mainstream-ready",
};

/**
 * Plain "can-do" statement for a strand at a level — one short sentence
 * summarizing the Ontario ESL expectations for that skill at that level.
 */
export const STRAND_LEVEL_CANDO: Record<Strand, Record<number, string>> = {
  reading: {
    1: "Reads simple instructions, brief information paragraphs, and adapted stories, using pictures and sight words to build vocabulary.",
    2: "Reads adapted and original texts, using graphic organizers and connecting words (first, second, finally) to compare information across sources.",
    3: "Studies and interprets grade-level texts, using transition words and academic vocabulary strategies (word webs, cognates).",
    4: "Reads critically — evaluating sources for authority, reliability, and objectivity — and works with synonyms, antonyms, and register.",
    5: "Synthesizes information from multiple complex sources and independently infers nuanced word meaning from context.",
    6: "Reads at grade level; no ESL support needed.",
  },
  listening: {
    1: "Understands specific information in simple directions, instructions, and short talks on familiar topics, supported by visual and contextual cues.",
    2: "Takes part in structured conversations and short oral presentations, with attention to pronunciation (past-tense endings, plurals, word stress).",
    3: "Participates actively in class discussions and seminars.",
    4: "Takes notes from complex directions and presentations using written outlines and graphic organizers.",
    5: "Takes detailed notes, summarizes documentaries and news reports, and uses pitch, volume, and repair strategies in complex talk.",
    6: "Understands spoken English at grade level; no ESL support needed.",
  },
  grammar: {
    1: "Uses basic structures in context: singular/plural nouns, subject pronouns, simple present/past/future, present progressive, common adjectives and adverbs, and simple sentences with basic conjunctions and punctuation.",
    2: "Uses question inversion, negative imperatives, compound sentences (and/but/or/because), and literal phrasal verbs (take off, put away).",
    3: "Uses collective, indefinite, and relative pronouns; the present perfect; tag questions; and figurative phrasal verbs (give up, look after).",
    4: "Uses abstract nouns, non-defining relative clauses, modals, negative information questions, and a wider range of phrasal verbs.",
    5: "Uses advanced tenses (future perfect, past perfect progressive), the passive with modals, and paired conjunctions (not only… but also).",
    6: "Uses grade-level grammar accurately; no ESL support needed.",
  },
  writing: {
    1: "Writes phrases and short sentences to share basic personal information; completes simple forms and short journal entries.",
    2: "Organizes information into short paragraphs with a topic sentence, supporting details, and a concluding sentence.",
    3: "Writes longer forms — narratives, articles, and summaries — and creative pieces expressing personal ideas.",
    4: "Writes complex academic texts (debate outlines, autobiographies, articles) and paraphrases using indirect speech.",
    5: "Writes complex, cohesive academic texts — comparative reports, formal letters, and syntheses of multiple sources.",
    6: "Writes at grade level; no ESL support needed.",
  },
};

/** Full band label, e.g. "Beginning · ESL Level 1 (ESLAO)". */
export function levelBandLabel(level: number): string {
  const band = LEVEL_BAND[level] ?? `Level ${level}`;
  if (level >= 6) return `${band} · no ESL course`;
  const course = LEVEL_COURSE[level];
  return course ? `${band} · ESL Level ${level} (${course})` : band;
}

/** Plain can-do description for a strand at a level. */
export function candoDescription(strand: Strand, level: number): string {
  return STRAND_LEVEL_CANDO[strand]?.[level] ?? "";
}
