import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { attempts } from "../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

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
      recommendation: attempts.recommendation,
    })
    .from(attempts)
    .orderBy(desc(attempts.startedAt))
    .limit(50);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Placement Queue</h1>
          <span className="text-sm text-gray-500">
            Signed in as {session.user.email} · {session.user.role}
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400 text-sm">
            No attempts yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow divide-y">
            {queue.map((row) => (
              <div key={row.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-mono text-gray-700">{row.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {row.startedAt.toLocaleString()}
                    {row.finishedAt && ` → ${row.finishedAt.toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={row.status as string} />
                  <Link
                    href={`/${locale}/attempt/${row.id}/review`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            ))}
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
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}
