# CLT Assessment — Project Overview

## What it does

An adaptive placement test for English Language Learners (ELLs). A student sits down, answers questions, and receives a recommended ESL course placement — no teacher scoring required.

## How placement works

The test has **4 strands**: Reading, Listening, Grammar, Writing.

Each strand goes through 3 stages (12 questions per strand, ~48 total):

1. **Route** (4 questions) — mid-difficulty items that gauge where to start
2. **Target** (4 questions) — items at the student's estimated level to narrow down
3. **Confirm** (4 questions) — items above and below the estimate to verify

The engine adapts in real time: if a student aces the route stage, they get harder items in the target stage. If they struggle, they get easier ones.

At the end, each strand produces a level (1–6) and the system maps the lowest level to an Ontario ESL course code (e.g., ESLAO, ESLBO, etc.).

## Current state

| Component | Status |
|-----------|--------|
| Adaptive engine (MSAT) | ✅ Complete — pure TypeScript, fully tested |
| Item bank (reading, grammar) | ✅ Seeded — some L4/L5 reading passages need content review |
| Listening items | 🚧 Routing works, audio not yet generated |
| Writing items | ✅ Prompts seeded, scored as pass-through in demo |
| Demo/sandbox mode | ✅ Complete — no database writes, visual routing tree |
| Live assessment mode | 🚧 Intake form exists, DB schema ready, not yet wired end-to-end |
| Report generation | 🔲 Not started |
| Teacher dashboard | 🔲 Not started |

## How to test

Go to `/en/demo`. You'll see a strand picker with options:

- **Full assessment** — all 4 strands (~48 questions)
- **Single strand** — just reading, grammar, or writing (~12 questions)
- **Skip to results** — generates random answers instantly and shows the placement result (for reviewing the output screen without answering questions)

The routing tree on the right side shows the engine's decision-making in real time as you answer.

## Tech stack

- Next.js (React) + TypeScript
- Supabase (PostgreSQL) for item bank and future student data
- Drizzle ORM
- Tailwind CSS
- Deployed on Vercel

## What's next

1. **Content review** — audit and fix remaining reading passages (L4–L5)
2. **Listening audio** — generate audio files for listening comprehension items
3. **Report page** — student-facing placement summary with per-strand breakdown
4. **Live mode** — connect intake → assessment → report with real DB persistence
5. **Teacher dashboard** — view student results, flag reviews, override placements
