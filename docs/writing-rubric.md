# Writing Assessment Rubric — Reference

This is the reference source for how the writing strand is scored. The
AI writing-grader ([`src/server/writing-grader.ts`](../src/server/writing-grader.ts))
evaluates a student's essay against the traits below and produces an overall
writing level (1–5), which maps to the ESL levels described in
[esl-standards.md](./esl-standards.md).

The machine-readable version of this rubric lives in
[`src/server/writing-rubric.ts`](../src/server/writing-rubric.ts) — keep the two
in sync.

## How scoring works

1. The student writes one open-response essay from a prompt.
2. The grader scores each **trait** on a 1–5 scale.
3. The overall writing level is the **weighted mean** of the trait scores,
   rounded to the nearest integer.

## The 1–5 scale

The scale mirrors the ESL proficiency bands (see esl-standards.md):

| Score | Band | Descriptor |
|---|---|---|
| 1 | Beginning | Very limited control; errors severely impede communication. |
| 2 | Developing | Basic control; frequent errors, but partial meaning is conveyed. |
| 3 | Expanding | Adequate control; some errors; meaning is generally clear. |
| 4 | Consolidating | Good control; occasional errors; communicates effectively. |
| 5 | Bridging | Strong control; rare/minor errors; confident, fluent communication. |

## Traits

| Trait | Weight | What it measures |
|---|---|---|
| **Task Fulfillment** | 0.25 | Does the writing address the prompt with relevant, sufficient content? |
| **Organization & Coherence** | 0.20 | Are ideas ordered logically and connected (topic sentences, sequencing, linking words)? |
| **Vocabulary** | 0.20 | Range and accuracy of word choice for the task. |
| **Grammar & Sentence Structure** | 0.25 | Control of sentence forms, tenses, and agreement. |
| **Mechanics** | 0.10 | Spelling, punctuation, and capitalization. |

Weights sum to 1.00. Task Fulfillment and Grammar are weighted most heavily,
reflecting the ESL emphasis on communicating meaning.

## Fairness notes (for the grader)

- Students are writing in English as a **second/additional language** — assess
  what they *can* do, not only their errors.
- A beginner who writes simple sentences well should still score in the middle
  range on **Task Fulfillment** if the task is met.
- Do not penalize for non-standard but comprehensible phrasing at lower levels.

## Source & citation

The trait structure and proficiency bands are adapted from the Ontario secondary
ESL writing expectations and the province's observational writing continuum:

> Ontario Ministry of Education. (2007). *The Ontario Curriculum, Grades 9–12:
> English as a Second Language and English Literacy Development (Revised)*.
> Queen's Printer for Ontario.
> https://www.edu.gov.on.ca/eng/curriculum/secondary/esl912currb.pdf

> Ontario Ministry of Education. *STEP: Steps to English Proficiency — A Guide
> for Users* (Writing continuum). Queen's Printer for Ontario.

**TODO (verify):** confirm the exact STEP document title/edition and URL, and
map each trait/level to specific STEP writing-continuum descriptors before any
official or student-facing use. The rubric here is a reasonable working
adaptation, not a verbatim reproduction of the source instruments.
