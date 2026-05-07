import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import {
  attempts,
  attemptItems,
  items,
  recommendationOverrides,
} from "../../../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import type { Recommendation, Flag } from "@/engine/types";
import type { TraitScore } from "@/server/writing-grader";
import { OverrideForm } from "./OverrideForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EssayGrading {
  scoredTraits: TraitScore[];
  scoredLevel: number;
  modelRationale: string;
  model: string;
  rubricVersion: string;
}

interface EssayResponse {
  text: string;
  grading?: EssayGrading;
  gradingError?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AttemptReviewPage({
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

  const [rows, overrideRows] = await Promise.all([
    db
      .select({
        ai: attemptItems,
        item: {
          subskill: items.subskill,
          format: items.format,
        },
      })
      .from(attemptItems)
      .leftJoin(items, eq(attemptItems.itemId, items.id))
      .where(eq(attemptItems.attemptId, id))
      .orderBy(attemptItems.presentedAt),
    db
      .select()
      .from(recommendationOverrides)
      .where(eq(recommendationOverrides.attemptId, id))
      .orderBy(desc(recommendationOverrides.createdAt))
      .limit(1),
  ]);

  const rec = attempt.recommendation as Recommendation | null;
  const intake = attempt.intakeAnswers as Record<string, string> | null;
  const existingOverride = overrideRows[0] ?? null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/queue`} className="text-sm text-blue-600 hover:underline">
            ← Queue
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-mono text-xs text-gray-400">{id}</span>
          {attempt.status === "complete" && (
            <Link
              href={`/${locale}/attempt/${id}/report`}
              className="text-xs text-indigo-600 hover:underline"
            >
              View Report →
            </Link>
          )}
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              attempt.status === "complete"
                ? "bg-green-100 text-green-800"
                : attempt.status === "in-progress"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {attempt.status}
          </span>
        </div>

        {/* Intake */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Student Intake</h2>
          {intake ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {Object.entries(intake).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-400 text-xs">{k}</dt>
                  <dd className="text-gray-900">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-gray-400 text-sm">No intake data.</p>
          )}
        </section>

        {/* Recommendation */}
        {rec ? (
          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Engine Recommendation</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stat label="Course" value={rec.course} />
              <Stat label="Stream" value={rec.stream} />
            </div>
            {rec.flags && rec.flags.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Flags</p>
                <div className="flex gap-2 flex-wrap">
                  {rec.flags.map((f: Flag) => (
                    <span
                      key={f.code}
                      className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                    >
                      {f.code}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {rec.perStrandLevel && (
              <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                {Object.entries(rec.perStrandLevel).map(([strand, level]) => (
                  <Stat key={strand} label={strand} value={String(level)} />
                ))}
              </div>
            )}

            {/* Reasoning trace */}
            {rec.reasoning && rec.reasoning.length > 0 && (
              <details className="mt-4">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  Engine reasoning trace ({rec.reasoning.length} steps)
                </summary>
                <ol className="mt-2 text-xs text-gray-500 space-y-0.5 list-decimal list-inside leading-relaxed">
                  {rec.reasoning.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </details>
            )}

            {/* Override form — only for complete attempts */}
            {attempt.status === "complete" && (
              <OverrideForm
                attemptId={id}
                currentCourse={rec.course}
                currentStream={rec.stream as "esl" | "eld" | "mainstream"}
                existingOverride={
                  existingOverride
                    ? {
                        course: (existingOverride.override as { course: string }).course,
                        stream: (existingOverride.override as { stream: "esl" | "eld" | "mainstream" }).stream,
                        reason: existingOverride.reason,
                        createdAt: existingOverride.createdAt,
                      }
                    : null
                }
              />
            )}
          </section>
        ) : (
          attempt.status !== "complete" && (
            <div className="bg-white rounded-xl shadow p-5 text-sm text-gray-400 text-center">
              Assessment in progress — recommendation will appear when complete.
            </div>
          )
        )}

        {/* Response log */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-700 p-5 border-b">Response Log</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Strand", "Stage", "Lvl", "Format", "Subskill", "Correct", "Time (s)"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ ai, item: meta }) => {
                const isEssay = meta?.format === "essay";
                const essayResp = isEssay
                  ? (ai.response as unknown as EssayResponse | null)
                  : null;

                return (
                  <>
                    {/* Main row */}
                    <tr key={ai.id} className={`${isEssay ? "bg-blue-50/30" : ""} hover:bg-gray-50`}>
                      <td className="px-4 py-2 text-gray-900 capitalize">{ai.strand}</td>
                      <td className="px-4 py-2 text-gray-500">{ai.stage}</td>
                      <td className="px-4 py-2 text-gray-700">{ai.level}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs font-mono">
                        {meta?.format ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                        {meta?.subskill ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {isEssay && essayResp?.grading ? (
                          <span className="text-blue-700 font-semibold text-xs">
                            L{essayResp.grading.scoredLevel}
                          </span>
                        ) : ai.isCorrect === null ? (
                          <span className="text-gray-300">—</span>
                        ) : ai.isCorrect ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-500">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {ai.timeMs !== null ? (ai.timeMs / 1000).toFixed(1) : "—"}
                      </td>
                    </tr>

                    {/* Essay detail row */}
                    {isEssay && essayResp && (
                      <tr key={`${ai.id}-detail`} className="bg-blue-50/20">
                        <td colSpan={7} className="px-4 pb-4 pt-1">
                          <EssayDetail resp={essayResp} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No responses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Audit link */}
        <div className="text-right">
          <a
            href={`/api/attempts/${id}/audit.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Download audit JSON
          </a>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Essay detail panel
// ---------------------------------------------------------------------------

function EssayDetail({ resp }: { resp: EssayResponse }) {
  const { text, grading, gradingError } = resp;

  return (
    <div className="space-y-3">
      {/* Student essay text */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Student Essay
        </p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white border rounded-lg p-3 leading-relaxed">
          {text || <span className="text-gray-300 italic">No text submitted</span>}
        </p>
      </div>

      {/* Grading error fallback */}
      {gradingError && !grading && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
          Grading error: {gradingError}
        </div>
      )}

      {/* Trait scores */}
      {grading && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            AI Grading — Overall Level {grading.scoredLevel}{" "}
            <span className="normal-case text-gray-300 font-normal">
              ({grading.model} · rubric {grading.rubricVersion})
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {grading.scoredTraits.map((t) => (
              <div
                key={t.trait}
                className="bg-white border rounded-lg p-2 text-xs"
              >
                <div className="flex items-center justify-between mb-0.5">
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
          <div className="text-xs text-gray-600 bg-white border rounded-lg p-2 leading-relaxed">
            <span className="font-medium text-gray-500">Overall: </span>
            {grading.modelRationale}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
    </div>
  );
}
