/**
 * Static writing-assessment rubric.
 *
 * Machine-readable counterpart of docs/writing-rubric.md — keep the two in
 * sync. Used by the writing-grader so essay scoring needs no database.
 *
 * Weights sum to 1.0; the overall level is the weighted mean of trait scores.
 */

export interface RubricTrait {
  /** Field key the model returns. */
  name: string;
  /** Human-readable label shown on the report. */
  label: string;
  /** Weight in the overall level (all weights sum to 1.0). */
  weight: number;
  /** What the trait measures (also fed to the grader). */
  description: string;
}

export interface WritingRubric {
  version: string;
  /** 1–5 band descriptors, shared across traits. */
  scale: Record<number, string>;
  traits: RubricTrait[];
}

export const WRITING_RUBRIC: WritingRubric = {
  version: "esl-writing-v1",
  scale: {
    1: "Beginning — very limited control; errors severely impede communication.",
    2: "Developing — basic control; frequent errors but partial meaning is conveyed.",
    3: "Expanding — adequate control; some errors; meaning is generally clear.",
    4: "Consolidating — good control; occasional errors; communicates effectively.",
    5: "Bridging — strong control; rare/minor errors; confident, fluent communication.",
  },
  traits: [
    {
      name: "taskFulfillment",
      label: "Task Fulfillment",
      weight: 0.25,
      description:
        "Addresses the prompt with relevant, sufficient content and stays on topic.",
    },
    {
      name: "organization",
      label: "Organization & Coherence",
      weight: 0.2,
      description:
        "Orders ideas logically and connects them (topic sentences, sequencing, linking words).",
    },
    {
      name: "vocabulary",
      label: "Vocabulary",
      weight: 0.2,
      description: "Range and accuracy of word choice for the task.",
    },
    {
      name: "grammar",
      label: "Grammar & Sentence Structure",
      weight: 0.25,
      description:
        "Control of sentence forms, tenses, and subject–verb/word agreement.",
    },
    {
      name: "mechanics",
      label: "Mechanics",
      weight: 0.1,
      description: "Spelling, punctuation, and capitalization.",
    },
  ],
};
