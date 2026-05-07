import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { attempts } from "../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import type { Recommendation, Flag } from "@/engine/types";

interface IntakeAnswers {
  name?: string;
  [key: string]: unknown;
}

export default async function QueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user || session.user.role === "student") {
    redirect(`/${locale}/login`);
  }

  const queue = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      startedAt: attempts.startedAt,
      finishedAt: attempts.finishedAt,
      intakeAnswers: attempts.intakeAnswers,
      recommendation: attempts.recommendation,
    })
    .from(attempts)
    .orderBy(desc(attempts.startedAt))
    .limit(100);

  const completed = queue.filter((r) => r.status === "complete").length;
  const inProgress = queue.filter((r) => r.status === "in-progress").length;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Placement Queue</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {completed} complete · {inProgress} in progress
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/items`}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Item Bank →
            </Link>
            <span className="text-sm text-gray-500">
              {session.user.email} · {session.user.role}
            </span>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400 text-sm">
            No attempts yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow divide-y">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2 bg-gray-50 rounded-t-xl text-xs font-medium text-gray-400 uppercase tracking-wide">
              <span>Student / ID</span>
              <span>Started</span>
              <span>Course</span>
              <span>Status</span>
              <span />
            </div>

            {queue.map((row) => {
              const intake = row.intakeAnswers as IntakeAnswers | null;
              const rec = row.recommendation as Recommendation | null;
              const name = intake?.name as string | undefined;
              const flags = rec?.flags ?? [];
              const warnFlags = flags.filter(
                (f: Flag) => f.severity === "warn" || f.severity === "review"
              );

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 items-center hover:bg-gray-50/50"
                >
                  {/* Student / ID */}
                  <div className="min-w-0">
                    {name ? (
                      <>
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                        <p className="text-xs font-mono text-gray-400 truncate">{row.id}</p>
                      </>
                    ) : (
                      <p className="text-sm font-mono text-gray-600 truncate">{row.id}</p>
                    )}
                  </div>

                  {/* Started */}
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {row.startedAt.toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>

                  {/* Course + flags */}
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {rec?.course ? (
                      <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {rec.course}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                    {warnFlags.length > 0 && (
                      <span
                        title={warnFlags.map((f: Flag) => f.code).join(", ")}
                        className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium cursor-help"
                      >
                        ⚑ {warnFlags.length}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={row.status as string} />

                  {/* Actions */}
                  <div className="flex items-center gap-3 text-xs">
                    <Link
                      href={`/${locale}/attempt/${row.id}/review`}
                      className="text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Review →
                    </Link>
                    {row.status === "complete" && (
                      <Link
                        href={`/${locale}/attempt/${row.id}/report`}
                        className="text-gray-500 hover:underline whitespace-nowrap"
                      >
                        Report
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "in-progress": "bg-yellow-100 text-yellow-800",
    complete: "bg-green-100 text-green-800",
    abandoned: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
