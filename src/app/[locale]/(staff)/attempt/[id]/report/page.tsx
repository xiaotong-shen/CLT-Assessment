import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import { attempts, attemptItems, items } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Recommendation, Flag, Strand } from "@/engine/types";

// ---------------------------------------------------------------------------
// Flag descriptions (for report prose)
// ---------------------------------------------------------------------------

const FLAG_LABELS: Record<string, { label: string; note: string }> = {
  "uneven-profile": {
    label: "Uneven Language Profile",
    note: "Scores vary significantly across strands. Human review recommended to understand skill gaps.",
  },
  "stage-3-ambiguous": {
    label: "Borderline Placement",
    note: "Results place the student near a boundary between levels. Specialist review is advised.",
  },
  "stream-eld": {
    label: "ELD Stream Indicated",
    note: "Results suggest the student may benefit from the English Literacy Development (ELD) program rather than ESL.",
  },
  rushed: {
    label: "Short Response Times",
    note: "Several responses were submitted very quickly. Consider whether this student was able to engage fully.",
  },
  "rapid-clicks": {
    label: "Rapid Answer Selection",
    note: "Multiple-choice responses were selected unusually fast. Results may not be reliable.",
  },
  "writing-blank": {
    label: "Writing Not Completed",
    note: "The writing task was not submitted or was submitted without content. Writing level could not be assessed.",
  },
  "audio-skipped": {
    label: "Listening Task Not Completed",
    note: "Audio items were skipped or answered immediately. Listening level may be underestimated.",
  },
};

const STRAND_LABELS: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar / Language Structures",
  writing: "Writing",
};

const LEVEL_DESCRIPTORS: Record<number, string> = {
  1: "Beginning (STEP 1–2) — Communicates using isolated words and simple phrases",
  2: "Developing (STEP 2–3) — Produces simple sentences with support",
  3: "Expanding (STEP 3–4) — Communicates in simple and some complex sentences",
  4: "Consolidating (STEP 4–5) — Uses varied sentence structures with increasing accuracy",
  5: "Bridging (STEP 5–6) — Approaches grade-level language proficiency",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;

  if (!session?.user || session.user.role === "student") {
    redirect(`/${locale}/login`);
  }

  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, id))
    .limit(1);

  if (!attempt) notFound();
  if (attempt.status !== "complete") {
    redirect(`/${locale}/attempt/${id}/review`);
  }

  const rec = attempt.recommendation as Recommendation;
  const intake = attempt.intakeAnswers as Record<string, string> | null;

  const rows = await db
    .select({ ai: attemptItems, meta: { format: items.format } })
    .from(attemptItems)
    .leftJoin(items, eq(attemptItems.itemId, items.id))
    .where(eq(attemptItems.attemptId, id))
    .orderBy(attemptItems.presentedAt);

  const studentName = intake?.name ?? "Student";
  const assessmentDate = attempt.finishedAt ?? attempt.startedAt;
  const warnFlags = rec.flags.filter(
    (f: Flag) => f.severity === "warn" || f.severity === "review"
  );

  // Extract writing grading from essay responses
  const essayRow = rows.find((r) => r.meta?.format === "essay" && r.ai.response);
  const essayGrading = essayRow
    ? (
        (essayRow.ai.response as Record<string, unknown> | null)
          ?.grading as {
          scoredTraits: { trait: string; score: number; rationale: string }[];
          scoredLevel: number;
          modelRationale: string;
        } | undefined
      )
    : undefined;

  return (
    <main className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation (hidden on print) */}
        <div className="flex items-center gap-3 print:hidden">
          <Link
            href={`/${locale}/attempt/${id}/review`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Review
          </Link>
          <button
            onClick={() => window.print()}
            className="ml-auto text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Report header */}
        <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none print:border-b-2 print:border-gray-800">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
                ESL/ELD Placement Assessment
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{studentName}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Assessed:{" "}
                {assessmentDate.toLocaleDateString("en-CA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Recommended Placement</p>
              <p className="text-3xl font-bold text-indigo-700">{rec.course}</p>
              <p className="text-sm text-gray-500 capitalize">{rec.stream} stream</p>
            </div>
          </div>

          {/* Reasoning summary */}
          {rec.reasoning && rec.reasoning.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
              <p className="font-medium text-gray-700 mb-1">Assessment Summary</p>
              <ul className="list-disc list-inside space-y-0.5">
                {rec.reasoning.slice(0, 5).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Per-strand levels */}
        <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Language Skills Profile
          </h2>
          <div className="space-y-3">
            {(Object.entries(rec.perStrandLevel) as [Strand, number][]).map(
              ([strand, level]) => (
                <div key={strand}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 font-medium">
                      {STRAND_LABELS[strand] ?? strand}
                    </span>
                    <span className="text-sm font-bold text-indigo-700">
                      Level {level}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(level / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {LEVEL_DESCRIPTORS[level] ?? `Level ${level}`}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* Essay writing detail */}
        {essayGrading && (
          <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Writing Assessment Detail
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {essayGrading.scoredTraits.map((t) => (
                <div
                  key={t.trait}
                  className="border rounded-lg p-3 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700 capitalize">
                      {t.trait.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        t.score >= 4
                          ? "text-green-600"
                          : t.score >= 3
                          ? "text-yellow-600"
                          : "text-red-500"
                      }`}
                    >
                      {t.score}/5
                    </span>
                  </div>
                  <p className="text-gray-500 leading-tight">{t.rationale}</p>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
              <span className="font-medium text-gray-500">Overall (Level {essayGrading.scoredLevel}): </span>
              {essayGrading.modelRationale}
            </div>
          </section>
        )}

        {/* Flags */}
        {warnFlags.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:rounded-none">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">
              ⚑ Specialist Review Recommended
            </h2>
            <div className="space-y-3">
              {warnFlags.map((f: Flag) => {
                const info = FLAG_LABELS[f.code];
                return (
                  <div key={f.code} className="text-sm">
                    <p className="font-medium text-amber-900">
                      {info?.label ?? f.code}
                    </p>
                    <p className="text-amber-700 text-xs leading-relaxed">
                      {info?.note ?? f.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-300 pb-8 print:pb-4">
          <p>
            Assessment ID: <span className="font-mono">{id}</span> · Engine{" "}
            {rec.engineVersion} · Generated by CLT Assessment Platform
          </p>
        </footer>
      </div>
    </main>
  );
}
