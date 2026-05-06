# Adaptive ESL/ELD Placement Platform — Design Document

## 1. Purpose

Build an adaptive online assessment that places ESL learners into one of Ontario's
ten secondary-school English-as-a-Second-Language pathways — **ESLAO → ESLEO** for
students with prior age-appropriate schooling, or **ELDAO → ELDEO** for students
with significant gaps in first-language literacy — and produces a profile that a
school's intake counsellor can act on.

Reference curriculum: Ontario Grades 9–12 ESL/ELD (issued 2007; descriptions
updated August 2024). We also align the per-strand profile to Ontario's
**STEP — Steps to English Proficiency** observational continuum so the
school can talk about results in language its teachers already use.

The CLB-OSA reading sample in this repo is the structural inspiration: a single
test that ramps from "where would you see a DO NOT ENTER sign?" to inferential
questions on a passage about symbiotic fungi, with a fixed time budget and an
item-by-item flow. Our job is to do the same shape of thing, but adaptively, and
to map the score onto Ontario's ten ESL/ELD course codes rather than CLB bands.

### 1.1 Deployment context (single-tenant, private school)

The first deployment is a **single private school + tutoring company** with a
small student base, predominantly Chinese-L1. The platform is replacing a
third-party paid ESL assessment they currently outsource. This shapes the
design in several ways:

- **Single tenant.** No multi-school architecture, no per-school theming, no
  billing infrastructure. Hard-code the school in MVP; refactor to multi-
  tenant only if a second customer materializes.
- **Small N.** Volumes are low enough that an ESL specialist can review every
  uncertain placement. Confidence-flag-and-review beats a fully automated
  pipeline. This also means we will not have IRT-calibrating volumes for a
  long time — Phase 3 (IRT) may stay theoretical for a year or more.
- **Predominantly Chinese L1.** Item content for low levels should not assume
  Canadian cultural background that newly-arrived students wouldn't have
  (mailing addresses, hockey, Tim Hortons, etc.). Where it's faster to use
  L1-anchored cues at very low levels (e.g. simplified-Chinese instructions
  on the very first page only), we will — but the test itself stays in
  English.
- **Proof-of-concept stage.** Validity *evidence* (full pilot, kappa, DIF
  analysis) is deferred. Validity *traceability* — every placement is
  reproducible from logged item-level data and a human reviewer can see why
  the engine landed where it did — is required from day one.
- **Cost transparency is a deliverable of the POC, not a footnote.** Phase 1
  funding has to come from the school's third-party assessment line; Phase
  2 funding (the speaking strand, see §3) depends on the POC being
  presentable to leadership with concrete cost numbers. The doc has a
  dedicated cost model (§14) that's intended to be lifted directly into
  the demo deck.

## 2. Why this is non-trivial

Three things make this harder than a generic quiz app:

1. **Ontario's curriculum doesn't define numeric proficiency cut-points.** The
   levels are described in prose ("short adapted texts", "a variety of grade-
   level texts"). Anything we build has to bridge prose descriptors to scoreable
   items, which is a measurement-design problem, not just a coding problem.
2. **ELD vs ESL is a routing decision, not a difficulty decision.** A student
   who reads fluently in their L1 but knows no English belongs in ESLAO. A
   student who has had three years of disrupted schooling and limited L1
   literacy belongs in ELDAO — even if their spoken English is similar. The
   intake instrument has to detect that, and not just measure English.
3. **An adaptive test needs calibrated items to be defensibly adaptive.** We
   will not have IRT-calibrated items on day one. The design has to be honest
   about that and sequence in a way that becomes more defensible as data
   accumulates, rather than pretending to do CAT from the start.

## 3. Recommendation (the short version)

Build it in three phases, each independently useful. **Speaking moved from
Phase 3 to Phase 2** because stakeholder review confirmed it's a dealbreaker
for fully replacing the third-party assessment — IRT calibration, by contrast,
can wait until volume justifies it.

- **Phase 1 — Multi-stage placement (MSAT) + human review loop.** Deterministic
  stage routing, no IRT. Three stages (Routing → Targeting → Confirmation),
  score is a weighted count, output is one of {ELDAO, ELDBO, ELDCO, ELDDO,
  ELDEO, ESLAO, ESLBO, ESLCO, ESLDO, ESLEO} **plus a STEP profile** (per-
  strand step 1–6) and a **confidence flag** that triggers specialist review
  for ambiguous placements. Reading + Listening + Grammar/Vocab cloze +
  Writing (single prompt, LLM rubric grader). Bilingual (EN + zh-Hans) intake
  survey and family-facing report; **PDF report** as the canonical deliverable.
  Speaking deferred but architected for.
- **Phase 2 — Speaking strand.** Committed scope, budget-gated by the Phase 1
  POC. Browser audio capture, transcription, LLM rubric grading aligned to
  Ontario STEP Speaking continuum. Indicative cost lines in §14.5 so school
  leadership can budget concretely from the demo. Engineering: 4–6 weeks
  once funded.
- **Phase 3 — Calibrated items (IRT) + practice loop.** Once we have ≥ ~300
  responses per item across a representative sample, fit a 2-parameter
  logistic IRT model and switch the engine to maximum-information item
  selection with a stopping rule on the standard error of theta. At single-
  school volumes this is realistically 12–18 months out — Phase 1 has to be
  valuable on its own for a long time. Phase 3 also adds in-product
  practice modules tied to placement gaps and a teacher dashboard.

The single biggest tradeoff: we are choosing **defensible-and-shippable** over
**maximally adaptive on day one**. For a single school replacing a paid
third-party assessment, "ships in 8–10 weeks, every placement is human-
auditable, comes with a PDF the school can hand to families, costs less than
the third party" wins over "ships in 9 months with full IRT and a validity
report nobody reads."

## 4. Scope of MVP (Phase 1)

### 4.1 Strands assessed

| Strand        | MVP? | Why                                                       |
|---------------|------|-----------------------------------------------------------|
| Reading       | Yes  | Cheap to author, deterministically scoreable, anchors level |
| Listening     | Yes  | Distinguishes ELD candidates, audio is easy to ship        |
| Grammar/Vocab | Yes  | Cloze + MC; high information per minute of student time    |
| Writing       | Yes (light) | One short constructed-response, rubric-graded by LLM |
| Speaking      | **No (Phase 2 — committed)** | Stakeholder-confirmed dealbreaker; gap visible from day one. POC must surface the cost line so leadership can budget it (§14.5). |

### 4.2 Length and time

Target ≤ 45 minutes total for the placement test. CLB-OSA reading alone is 12
items in 60 minutes; we are doing more strands so each strand is shorter and
adaptivity does the work of covering the range.

Approximate budget:
- Intake survey (schooling history, L1, time in English-medium ed): 3 min
- Reading: 12 min, ~10–14 items
- Listening: 10 min, ~8–10 items
- Grammar/vocab cloze: 8 min, ~15–20 items
- Writing prompt: 10 min, single response, ~80–120 words at higher levels
- Buffer + transitions: ~2 min

### 4.3 Out of scope for MVP

- Speaking strand
- French (the curriculum is published in French as well, but we are starting
  English-side only)
- Accommodations / IEP-aware variants
- Live proctoring
- Student-facing study modules

## 5. The placement engine — how MSAT actually works

Inspired by the multi-stage adaptive testing used by TOEFL Paper Edition and the
Duolingo English Test, but simpler.

### 5.1 Routing

Each strand runs three stages:

```
            ┌───────────────┐
            │ Stage 1: ROUTE │   Mid-difficulty items spanning levels 2–4
            └───────┬───────┘
                    │  weighted score
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  Lower track   Mid track    Upper track
  (target 1–2)  (target 3)   (target 4–5)
       │            │            │
       └────────────┼────────────┘
                    ▼
            ┌──────────────────┐
            │ Stage 2: TARGET   │   Items concentrated near predicted level
            └────────┬──────────┘
                     ▼
            ┌──────────────────┐
            │ Stage 3: CONFIRM  │   Items at predicted level ± 1 to bracket
            └────────┬──────────┘
                     ▼
            Final level for this strand
```

Per-strand level then aggregates into a recommended course code (see §6).

### 5.2 Why three stages, not two and not five

Two stages doesn't give us a confirmation pass — students who get unlucky on
Stage 1 can get over-routed. Five stages spends too much of the time budget on
routing overhead. Three is the standard compromise and matches the time budget.

### 5.3 Scoring inside a stage

Each item has an authored difficulty `d ∈ {1..5}` (matched to ESL/ELD level).
A student's "level estimate" after a stage is the difficulty at which their
empirical accuracy crosses 50%. Concretely:

```
estimated_level = max d such that accuracy_at_d_or_below >= 0.7
                  AND accuracy_at_d+1 < 0.5
```

This is intentionally more conservative than a midpoint — placement errors that
push a student up cost more than errors that push down (a too-high placement
fails the student in week 1; too-low costs them a few weeks of relative ease and
they get re-evaluated).

### 5.4 Why not start with IRT

IRT requires per-item parameters (`a` discrimination, `b` difficulty,
`c` guessing) fit from real response data. With ~50 items per strand and zero
prior responses, any "calibration" we do is fictional. MSAT lets us ship with
authored-difficulty items, gather response data through real use, and switch to
IRT when the data justifies it. The user-facing experience is identical.

## 6. Mapping engine output to Ontario course codes (and STEP)

Three decisions happen in sequence: stream → level → STEP profile.

### 6.1 Stream selection (ESL vs ELD)

Driven primarily by the intake survey, secondarily by reading-vs-listening
asymmetry on the test:

- Self-reported years of formal schooling in any language < expected for age,
  AND L1-literacy self-rating ≤ "I can read short notes" → **ELD candidate**
- Listening level materially higher than reading level (≥ 2 levels) → **ELD
  candidate** (this is the classic profile of oral fluency without text-based
  schooling)
- Otherwise → **ESL candidate**

The survey alone shouldn't be authoritative — students sometimes overstate
schooling — but combined with the listening/reading delta it's a defensible
signal. Edge cases get flagged for human review rather than silently routed.

**Note for the launch deployment**: in a private-school Chinese-L1 base, ELD
candidates are expected to be rare (these students typically have continuous
prior schooling). The ELD branch is still built — leaving it out would make
the test wrong for the case it's most likely to mishandle — but we can ship
with thinner ELD item coverage (e.g. 2 passages per level instead of 6) and
backfill if an ELD student ever arrives. ELD-routed placements always go to
specialist review in MVP regardless of confidence.

### 6.2 Level selection

Within the chosen stream:

| Lowest strand level | Recommended course |
|---------------------|--------------------|
| 1                   | ESLAO / ELDAO      |
| 2                   | ESLBO / ELDBO      |
| 3                   | ESLCO / ELDCO      |
| 4                   | ESLDO / ELDDO      |
| 5                   | ESLEO / ELDEO      |
| 6 (no ESL needed)   | Mainstream English |

We use **lowest** strand, not average, because the curriculum is integrated:
ESLCO assumes the student can perform at Level 3 across all four strands. A
student strong in reading but weak in listening will struggle in a higher class.

Level 6 ("ready for mainstream") exists in STEP but not in the ESL course
codes — when the test produces it, the recommendation is "no ESL placement
needed" plus the per-strand profile, and the school decides on mainstream
English placement (ENG1D, ENG2D, etc.) outside this tool.

The report surfaces all per-strand levels so the specialist can override.

### 6.3 STEP profile

Ontario's **STEP — Steps to English Proficiency** rates each English language
learner on a 1–6 step continuum across four strands (Listening, Speaking,
Reading, Writing). It's the language Ontario teachers already use to talk
about ELL progress.

Our internal level scale (1–5 ESL/ELD courses, plus 6 = mainstream) maps
cleanly onto STEP:

| Engine level | STEP step | Course      |
|--------------|-----------|-------------|
| 1            | Step 1    | ESLAO/ELDAO |
| 2            | Step 2    | ESLBO/ELDBO |
| 3            | Step 3    | ESLCO/ELDCO |
| 4            | Step 4    | ESLDO/ELDDO |
| 5            | Step 5    | ESLEO/ELDEO |
| 6            | Step 6    | Mainstream  |

The placement report shows both. The specialist gets a "STEP profile" view
they can drop into a student's OSR observation; the family-facing version
shows the course recommendation in plain language.

Speaking is not measured in MVP — its STEP step is left blank with a note,
not estimated. Quietly inferring a Speaking step from Listening would be
exactly the kind of shortcut that erodes the specialist's trust in the tool.

## 7. Item bank design

### 7.1 Authoring requirements

Each item is authored with:

- **id** — stable
- **strand** — reading | listening | grammar | writing
- **level** — 1..5 (target ESL/ELD course)
- **subskill** — e.g. `literal-comprehension`, `inference`,
  `vocabulary-in-context`, `reference-resolution`, `main-idea`,
  `purpose-of-text`, `verb-tense`, `subject-verb-agreement`
- **format** — mc-single | mc-multi | cloze | matching | short-answer | essay
- **stem / passage / audio**
- **options + correct key + distractor rationales**
- **estimated time** (seconds)
- **Canadian-context flag** — items that assume knowledge of Canadian civic
  life are tagged so we don't penalize newly-arrived students
- **review status** — drafted | reviewed | piloted | live
- **response stats** (filled in by use): `n_attempts`, `p_correct`,
  `point_biserial`, eventually IRT `a`/`b`

### 7.2 Item style anchored to Ontario level descriptors

The 2007 Ontario ESL curriculum is descriptor-based, not item-bank-based. We
operationalize each level into concrete item characteristics:

| Level | Reading text type            | Item style                         | Example mirroring CLB-OSA |
|-------|------------------------------|-------------------------------------|---------------------------|
| 1     | Signs, labels, single words  | "Where would you see this?"         | DO NOT ENTER (sample 1)   |
| 2     | Short notes, simple ads       | Literal comprehension, basic vocab  | Carol's note (sample 2)   |
| 3     | Public notices, news briefs   | Main idea, simple inference         | Shoe sale flyer (sample 3) |
| 4     | Multi-paragraph adapted texts | Purpose, reference, vocab-in-context | Letter to visitors (sample 5) |
| 5     | Grade-level academic prose    | Inference, author's stance, lexical | Show review / fungi (samples 8, 10) |

This isn't arbitrary — it tracks the curriculum prose ("short adapted texts" →
"a variety of grade-level texts") plus the CLB sample's empirical ramp.

### 7.3 Authoring volume needed for MVP

Per strand per level, we need enough items that an adaptive engine doesn't
repeat content across stages, plus headroom for retirement when an item gets
over-exposed:

- **Reading**: 6 passages × 2–3 items × 5 levels = ~75 items
- **Listening**: 6 audio clips × 2 items × 5 levels = ~60 items
- **Grammar/Vocab**: 12 cloze items × 5 levels = ~60 items
- **Writing**: 3 prompts per level = 15 prompts (rubric is shared)

Total: ~210 items + 15 prompts. Realistic for a small authoring team if we
seed with LLM-drafted items reviewed by an ESL specialist. **LLM-only items
without expert review are not acceptable** — distractor quality is what makes
or breaks placement validity.

## 8. Writing-strand grading (rubric-driven LLM)

The writing prompt is the highest-information-per-minute item we have for
distinguishing levels 3, 4, and 5. The rubric reflects the curriculum
descriptors and is grouped into four traits:

- **Task fulfillment** — addresses the prompt, appropriate genre
- **Linguistic range** — sentence patterns, vocabulary breadth
- **Linguistic accuracy** — grammar, mechanics
- **Coherence** — paragraphing, cohesion, organization

Each trait scored 1–5; trait scores combine (currently equal weight) into a
writing-strand level. The Claude API does the rating with a structured prompt
that includes the rubric, a calibration sample at each band (anchor papers),
and required JSON output. We log the model's stated rationale per trait so a
human can audit any disputed score.

Cost note: ~10 min student-side, ~1 LLM call student-side, ~$0.005–$0.02 per
placement at current Anthropic pricing. Negligible.

## 9. Architecture

### 9.1 Stack

- **Frontend**: Next.js (App Router) + React + Tailwind. Single SPA, mobile-
  responsive (many students will take this on a phone or Chromebook).
- **Backend**: Next.js Route Handlers for the standard CRUD; a separate
  TypeScript service for the placement engine so its logic can be
  unit-tested in isolation from the HTTP layer.
- **DB**: Postgres. Drizzle ORM. Single-region to start.
- **Auth**: Magic-link email for students; password+SSO for staff. Anonymous
  attempts allowed for self-assessment, with optional account upgrade.
- **Object storage**: S3-compatible bucket for listening audio + writing
  artifacts.
- **AI**: Anthropic API (Claude) for writing-strand grading. Prompt-cached
  rubric so per-grade cost stays low.
- **Observability**: Per-item response logging from day one — this is what
  becomes the IRT calibration corpus in Phase 3.

### 9.2 Data model (sketch)

```
users(id, role, email, …)
test_attempts(id, user_id, started_at, finished_at, status, recommendation)
attempt_items(id, attempt_id, item_id, stage, presented_at, response,
              is_correct, time_ms)
items(id, strand, level, subskill, format, payload_jsonb, status)
prompts(id, level, prompt_text, rubric_id)
rubrics(id, version, traits_jsonb)
writing_responses(id, attempt_id, prompt_id, text, scored_traits_jsonb,
                  scored_level, model, model_rationale)
```

The `attempt_items` table is deliberately denormalized — keeping per-item
timestamps and time-on-item is what enables future calibration and exposure
control.

### 9.3 The placement engine as a pure module

Isolate selection logic in a service that is:

- input: `{ attempt_id, strand, history: [{item_id, level, correct}] }`
- output: `{ next_item_id | done, current_estimate, stage }`

This boundary is what lets us swap MSAT → IRT in Phase 3 without touching the
HTTP layer or the frontend.

## 10. Privacy, security, accessibility

- **Hosting jurisdiction: Canadian region.** AWS `ca-central-1` (Montréal) or
  GCP `northamerica-northeast` (Montréal/Toronto) for both the web app and
  Postgres. The cost delta vs `us-east-1` is small (~5–15%) and the story
  for a Canadian private school dealing with families who care about where
  their children's data lives is much cleaner. Object storage (audio /
  writing artifacts) follows the same rule.
- **PIPEDA, not FIPPA.** A private school + tutoring company is not a public
  body, so FIPPA doesn't apply directly. PIPEDA (federal) does, and good
  practice is the same: collect minimum data, document retention, give
  families a clear answer to "where is this stored and who can see it."
- **PII minimization.** Anonymous self-assessment attempts capture only an
  attempt token. For real placements we collect student name + DOB + L1 +
  prior schooling. No SIN, no health data, no parent contact in the
  assessment record itself.
- **AODA / WCAG 2.1 AA.** Captions for all listening audio, keyboard-only
  navigation, screen-reader labelling, extend-time toggle as primary
  accommodation lever.
- **Item security.** Items are not exposed in API responses except as the
  next-item payload during an active attempt. Items rotate; items with
  exposure > N attempts are retired. No item bank mirroring on the client.
- **Cultural-context guardrails on items.** Distractors and stems for
  Levels 1–2 are reviewed for assumed Canadian background knowledge that a
  newly-arrived Chinese-L1 student wouldn't have. The intent is to measure
  English, not enculturation.

## 11. Reporting

Three views per attempt, plus a **PDF deliverable** that's the canonical
artifact handed to families and the school.

**Student/family-facing (PDF + web)**: recommended course code (e.g. ESLCO),
one paragraph in plain language about what that course covers (lifted from
the Ministry descriptors), and one or two specific subskills to practice. No
raw scores. **Generated as a PDF**, available bilingually — English and
Simplified Chinese (zh-Hans) versions of the same report. The PDF is the
formalization of defensibility: it's reproducible from logged data, signed by
specialist on review, and replaces the document the third-party assessment
currently mails to families.

**Specialist-facing (web)**: per-strand level + STEP step, confidence band,
attempt timeline, **all flags** that fired (rapid-clicking, ELD/ESL routing
edge cases, ambiguous mid-stage routing, writing-prompt non-attempt, time-
on-task outliers), the engine's reasoning trace ("Stage 1 score 6/8 → routed
to upper track; Stage 2 confirmed Level 4; Stage 3 ambiguous between L4 and
L5, recommending L4 with a flag"), the writing-rubric LLM rationale, and an
override button. English-only — internal tool.

**Audit trail (downloadable JSON)**: every item shown, every response, every
score component, the exact engine version and item-bank snapshot. This is the
"defensibility" lever — even without a formal validity study, every placement
can be reconstructed and second-guessed.

### 11.1 Confidence and flag triggers

A placement is **flagged for specialist review** if any of:

- The lowest strand and the next-lowest strand differ by more than one level
  (uneven profile)
- Stage 3 ambiguity in any strand (within-strand variance crosses the level
  boundary)
- The student is routed to ELD (regardless of confidence)
- Total time on test < 50% of expected (likely rushing)
- ≥ 3 items answered in < 2 seconds each (rapid-clicking)
- Writing prompt left blank or under 20 words at expected level ≥ 3
- Audio playback never triggered on any listening item

Unflagged placements are still reviewable, but the specialist's queue
prioritizes flagged ones. **Overrides** are stored separately and never feed
back into engine logic — keeps the human's authority intact and prevents
silent drift.

### 11.2 Bilingual delivery (English + Simplified Chinese)

Both the **intake survey** and the **family-facing report** ship in EN and
zh-Hans. Implementation:

- **Static UI strings + canonical content** (intake question stems, course
  descriptors, plain-language explanations of what each ESL course covers,
  STEP step labels) are stored as i18n message catalogs. Each translation
  reviewed once by the ESL specialist before launch; effectively zero
  per-placement translation cost.
- **Dynamic per-student content** (specific subskills to practice, the
  specialist's review note if any) is generated in English and translated
  on-the-fly via the Claude API at PDF render time. ~$0.003–0.01 per
  placement; cheaper than a translation memory service for our volumes.
- **Test items themselves stay English**. It's an English assessment;
  translating the items would defeat the measurement.
- **Specialist tooling stays English**. Internal-only.

CJK fonts must be embedded in the PDF (Noto Sans SC is the standard pick).
Caught at render-time tests, not after a parent prints the report.

### 11.3 PDF generation

Server-side **Playwright** (headless Chromium) renders HTML/CSS templates to
PDF. Chosen over alternatives because:

- Native CJK font handling (matters for the zh-Hans version)
- Layout fidelity matches what we see in dev
- Easy to template with Next.js / React components, same code as the web
  view
- One stack, not two; no separate PDF DSL to learn

Each rendered PDF embeds the attempt id and engine version in a footer so
any specialist can find the audit trail later.

## 12. Validation plan

For a single-school proof-of-concept, full pre-launch validation is
disproportionate — but "we'll figure it out later" is the path to a tool no
specialist trusts. The middle path:

**Required before MVP launch (1–2 weeks of specialist time):**

1. **Content validity sign-off.** ESL specialist reviews every item against
   its target level descriptor. Items they reject don't ship.
2. **Internal calibration run.** Specialist takes the test as if a
   hypothetical Level-3 student, Level-4 student, etc. (i.e. answers to
   their target level). Confirms the engine lands on the intended course
   code each time.
3. **Cultural-context audit.** Same specialist scans Levels 1–3 stems and
   distractors for assumed Canadian background; flagged items are rewritten
   or retired.

**Ongoing through pilot use (first ~3 months of real placements):**

4. **Concurrent validity check.** For each real placement, the specialist
   records whether they agree with the engine. Disagreements → audit trail
   review → either an override (item-level data preserved) or an item-level
   correction. After 30 attempts the agreement rate is the headline metric.
5. **Inter-rater check on writing.** First 20 writing samples get scored
   independently by the specialist alongside the LLM rubric grader. If
   trait-level agreement is poor we tighten the rubric and re-score. We are
   not gating on Cohen's kappa for the proof of concept, but we are
   tracking it.

**Deferred to Phase 3 (when volume permits):**

6. **IRT calibration.** Per-item `a` and `b` parameters from real response
   data once each item has ≥ ~300 attempts. At single-school volumes this
   may be a year+ out, so MSAT has to feel good in its own right.
7. **Differential item functioning.** Less urgent in a near-uniform L1 base,
   but on the radar if the student population diversifies.

The shift vs a textbook validation plan: trust is built **continuously
through the audit trail and override loop**, not through a one-time validity
report. That's the right shape for a tool replacing a third-party assessment
in a small school.

## 13. Risks

| Risk | Mitigation |
|------|------------|
| ELD students mis-routed into ESL because the survey misclassifies them | Two-signal routing (survey + listening/reading delta); flag edge cases for human review |
| Writing rubric grader drifts as Claude versions change | Pin model + rubric version per attempt; re-grade pilot corpus on every model change |
| Item exposure / memorization | Retirement threshold; multiple parallel items per (level, subskill) |
| LLM-authored items have weak distractors | Required ESL-specialist review before items go `live` |
| Ontario curriculum revision | Levels are stable since 2007; descriptors updated 2024. Treat curriculum reference as a dated input and revisit annually |
| Test-takers with disabilities | AODA from day one; extend-time toggle in MVP |
| POC fails to secure Phase 2 funding | Bake cost transparency into the demo (§14); make the per-placement savings vs third party the headline; ensure speaking is shown as a costed, scoped, ready-to-build addition rather than a vague aspiration |

## 14. Cost model and budget lines

This section is intended to be lifted directly into the POC demo deck.
"What does this cost vs the third party?" is the most persuasive question
the school's leadership will ask, and the answer is what unlocks Phase 2
(speaking) funding.

All numbers are **CAD, indicative**, sourced from current public pricing
(Anthropic, AWS, ElevenLabs, OpenAI). Treat them as order-of-magnitude;
firm them up before the demo.

### 14.1 Per-placement variable cost (Phase 1)

| Line item                              | Estimate per placement | Notes |
|----------------------------------------|------------------------|-------|
| Claude API — writing rubric grader     | $0.005–0.02            | Sonnet, prompt-cached rubric + anchor papers |
| Claude API — engine reasoning trace    | $0.001                 | Short structured output explaining the placement |
| Claude API — on-the-fly zh-Hans translation of dynamic report content | $0.003–0.01 | English first, translated for the Chinese version of the PDF |
| Object storage — writing artifact      | < $0.0001              | A few KB of text |
| PDF render compute                     | < $0.005               | Playwright on the same hosting tier; bursty |
| **Total per placement (MVP)**          | **< $0.05**            | |

At 100 placements/year (a generous cap for a small private school), variable
cost is well under $5/year total. It is, in practical terms, free at this
volume — the third-party fee is the only meaningful comparison.

### 14.2 Fixed monthly cost (Phase 1)

| Line item                          | Estimate (CAD/month) | Notes |
|------------------------------------|----------------------|-------|
| Hosting (Vercel Pro or AWS small)  | $0–35                | Vercel hobby is free; Pro at $26 USD/mo unlocks Canadian region for the function endpoints |
| Postgres (managed, ca-central-1)   | $0–30                | Supabase free tier covers MVP volume; Neon similar |
| Object storage (S3 ca-central-1)   | $1–5                 | Audio for listening items + writing artifacts |
| Domain                             | ~$2 (amortized)      | One-time ~$15/yr |
| Email (magic-link auth + report delivery) | $0–10         | Resend free tier covers MVP volume |
| **Total fixed (MVP)**              | **~$5–80/month**     | Realistically $20–40 once Pro tiers are needed |

Annualized fixed cost: ~$100–500. Round up to $1000/year for headroom and
that's the entire infrastructure budget.

### 14.3 One-time costs

| Item                                          | Estimate |
|-----------------------------------------------|----------|
| Listening audio TTS (~60 clips, North American voice) | $20–60 (OpenAI TTS or ElevenLabs) |
| Listening audio TTS premium (Canadian-English where supported) | + ~50% if available; **skip for POC** unless effectively free |
| zh-Hans translation of static intake/report templates | $0 (Claude + specialist sign-off) or ~$200 if outsourced |
| PDF design template (HTML/CSS)                | Internal time |
| ESL specialist review hours (Phase 1)         | Existing in-house — no incremental cost |

### 14.4 The headline number — vs the third-party

The single most persuasive line in the demo, now with real numbers:

> **In-house cost per placement ≈ $0.05 | Third-party fee per placement = $70 (reading + writing only) | Savings per placement ≈ $69.95**

The third-party currently does **not** offer speaking — that's a strict
gap, not just a pricing one. Once Phase 2 ships, the in-house platform
covers a strand the school cannot currently buy at any reasonable price.

Break-even on the entire infrastructure budget (~$1,000/year fixed, §14.2)
arrives at **~15 placements/year**. At any realistic intake volume the
platform pays for itself many times over in its first year.

### 14.5 Speaking strand — Phase 2 cost line (committed scope)

The POC demo presents speaking as **costed, scoped, ready to build** — not
as an open question. This is what makes the budget conversation concrete.

| Line item                                | Estimate | Notes |
|------------------------------------------|----------|-------|
| Engineering build                        | 4–6 weeks | Browser audio capture, transcription pipeline, rubric, UI |
| Specialist rubric calibration            | ~1 week (40 hr) × $30/hr = **$1,200** | Anchor responses across STEP Speaking 1–6 |
| Whisper / equivalent transcription       | ~$0.006 per minute of audio | OpenAI Whisper API; alternatives similar |
| Object storage for audio                 | $0.025 / GB / month | Audio retention policy: 90 days then auto-purge unless flagged |
| Claude API — speaking rubric grader      | similar to writing — $0.005–0.02 per placement | |
| Per-placement variable cost (speaking)   | **~$0.05–0.15** | Dominated by transcription minutes × audio length |

Total Phase 2 cost line for the demo:

> *Speaking strand: ~$Z engineering (4–6 wks × engineer rate) + $1,200
> specialist calibration + ~$0.10 / placement variable. Closes a strand
> the school cannot currently buy from the third party.*

The "third party doesn't offer speaking" framing turns Phase 2 from "more
spend" into "scope expansion the existing vendor can't match."

Post-launch concurrent-validity review effort (separate from Phase 2 build):
~30 reviews × ~15 min × $30/hr ≈ **$225** total over the first three months.

### 14.6 Phase 3 (IRT + practice) — placeholder

Phase 3 is volume-gated, not budget-gated. Indicative cost is engineering
time only: ~6–8 weeks once volume justifies starting. Practice modules and
a teacher dashboard are scope adjacent, also engineering-only. Not on the
critical path for this demo.

### 14.7 What to put on the demo slide

A single slide, three rows:

```
              Phase 1 (now)        Phase 2 (committed)       Phase 3 (later)
              MVP placement        Speaking strand           IRT + practice
Build cost    ~8–10 wks eng        +4–6 wks eng              +6–8 wks eng (volume-gated)
Variable      < $0.05 / placement   +$0.10 / placement        no change
Fixed         ~$1k / year          unchanged                  unchanged
What it does  Replaces 80% of the  Closes the speaking       Adds true CAT once we
              third-party scope    gap; full replacement     have data; plus practice
```

That slide is the goal of the POC demo, not a side-effect.

## 15. Build order (Phase 1, ~8–10 weeks)

Compressed from the original 12-week plan because (a) ESL specialist is
in-house and can author/review on a continuous basis rather than at the end,
(b) single-tenant means no multi-school plumbing, (c) the launch bar is
specialist-trust + audit-trail rather than published validity evidence.

1. **Week 1**: Schema, attempt lifecycle, intake survey, auth, hosting
   provisioned in Canadian region. i18n scaffolding (EN + zh-Hans) wired
   from day one — retrofitting is much more expensive than starting
   bilingual. No test items yet.
2. **Weeks 2–3**: MSAT engine as a pure module + tests against synthetic
   response patterns. Engine reasoning trace exposed in dev UI from the
   start (this becomes the audit trail in §11).
3. **Weeks 3–5** *(overlaps with engine)*: Reading strand end-to-end with
   ~30 seed items authored by ESL specialist (6 passages × 5 levels, 1–2
   items each) — this is the spine.
4. **Weeks 5–7**: Grammar/vocab cloze + listening; reuse engine. Listening
   audio TTS-generated in batch (one-time cost, see §14.3).
5. **Weeks 7–9**: Writing prompt + LLM rubric grader; STEP-aligned reporting
   pages; specialist review queue with flag triggers and override flow.
   **PDF generation pipeline (Playwright) + zh-Hans translation of static
   templates** lands in this window — the PDF is the headline artifact for
   the demo, so it can't be an end-of-build afterthought.
6. **Week 9–10**: Internal calibration run with the specialist (§12 step 2),
   fix what it surfaces, then run on a handful of real intake students with
   the specialist watching every result. Lock the cost numbers in §14
   against actual API + hosting bills before producing the demo deck.

After week 10: switch from "behind a flag" to default for new intakes,
keeping every placement specialist-reviewed for the first ~30 attempts
(that's the concurrent validity window).

## 16. Decisions resolved

The original five open questions are now closed:

| # | Question | Decision |
|---|----------|----------|
| 1 | Primary user | Single private school + tutoring company; mostly Chinese-L1 students; replacing a paid third-party assessment. Single-tenant MVP. |
| 2 | Self-assessment vs real course assignment | Real course assignment, with confidence flags and human specialist review for ambiguous cases (§11.1). |
| 3 | STEP alignment | Yes — produce a per-strand STEP step alongside the course code (§6.3). |
| 4 | ESL specialist for review | Available. Authoring + ongoing review built into Phase 1 timeline (§15). |
| 5 | Hosting jurisdiction | Canadian region (AWS `ca-central-1` or GCP `northamerica-northeast`). PIPEDA, not FIPPA, applies to a private operator (§10). |
| 6 | Translation scope | **Both** EN and zh-Hans for intake survey *and* family-facing report. Test items stay English. Specialist tooling stays English. (§11.2) |
| 7 | Audio voices for listening items | Cheap/fast wins. Default to a generic North American TTS voice; opt for Canadian-English only if the chosen provider supports it without a cost or speed penalty. (§14.3) |
| 8 | Replacing the third-party assessment — format | **Generated PDF** is the canonical deliverable. Doubles as the formalization of defensibility (audit-trail-stamped, specialist-signed). (§11, §11.3) |
| 9 | Re-test policy | No retakes in MVP. Item bank sized for one attempt per student; expansion is a later, low-priority task. |
| 10 | Speaking strand | Dealbreaker for full third-party replacement. Promoted from Phase 3 to **Phase 2 — committed**, budget-gated by POC outcomes. POC demo includes a costed, scoped Phase 2 plan (§14.5) so leadership can budget concretely. |

## 17. Decisions — round 3

| # | Question | Decision |
|---|----------|----------|
| 11 | Third-party fee per placement | **$70** (reading + writing). Speaking is a strict gap — the third party does not offer it, so Phase 2 = scope expansion, not just cost replacement. (§14.4) |
| 12 | Specialist's billed rate | **$30/hr**. Drives Phase 2 calibration line ($1,200) and post-launch concurrent-validity review (~$225 across the first three months). (§14.5) |
| 13 | PDF visual design | Indifferent — establish a clean own-brand template. ~1 day of template work, no engineering blocker. |
| 14 | PDF storage destination | School's existing student-records system. Integration is a separate spec (out of MVP critical path); for MVP, save to object storage + provide a downloadable link the specialist hands off. |
| 15 | Audio replay policy | Defer to Phase 2 / when listening strand is built; default in MVP is **one replay per item**, logged. Cheap to change later. |

The operational surface is now closed enough to begin implementation.
See [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for the Phase 1 build plan
written for hand-off to a coding model.

---

*Document version: 0.4 — third-round Q&A closed. Real numbers in §14
(third-party $70, specialist $30/hr). Implementation plan moved to a
sibling document.*
