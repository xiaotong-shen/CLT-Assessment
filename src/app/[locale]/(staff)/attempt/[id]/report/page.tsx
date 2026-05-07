import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import { attempts, attemptItems, items } from "../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Recommendation } from "@/engine/types";
import { ReportContent } from "./ReportContent";

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
  const studentName = (intake?.name as string | undefined) ?? "Student";
  const assessmentDate = attempt.finishedAt ?? attempt.startedAt;

  // Fetch essay grading if available
  const rows = await db
    .select({ ai: attemptItems, meta: { format: items.format } })
    .from(attemptItems)
    .leftJoin(items, eq(attemptItems.itemId, items.id))
    .where(eq(attemptItems.attemptId, id))
    .orderBy(attemptItems.presentedAt);

  const essayRow = rows.find(
    (r) =>
      r.meta?.format === "essay" &&
      (r.ai.response as Record<string, unknown> | null)?.grading !== undefined
  );
  const essayGrading = essayRow
    ? ((r: typeof essayRow) => {
        const g = (r.ai.response as Record<string, unknown>)?.grading as
          | {
              scoredTraits: { trait: string; score: number; rationale: string }[];
              scoredLevel: number;
              modelRationale: string;
            }
          | undefined;
        return g;
      })(essayRow)
    : undefined;

  return (
    <main className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb (hidden on print) */}
        <div className="flex items-center gap-2 text-xs text-gray-400 print:hidden">
          <Link href={`/${locale}/queue`} className="text-blue-600 hover:underline">
            Queue
          </Link>
          <span>/</span>
          <Link
            href={`/${locale}/attempt/${id}/review`}
            className="text-blue-600 hover:underline"
          >
            Review
          </Link>
          <span>/</span>
          <span>Report</span>
        </div>

        <ReportContent
          attemptId={id}
          rec={rec}
          studentName={studentName}
          assessmentDate={assessmentDate}
          essayGrading={essayGrading}
          locale={locale}
        />

        {/* Footer (always visible) */}
        <footer className="text-center text-xs text-gray-300 pb-8 print:pb-4">
          <p>
            Assessment ID: <span className="font-mono">{id}</span> · Engine{" "}
            {rec.engineVersion} · CLT Assessment Platform
          </p>
        </footer>
      </div>
    </main>
  );
}
