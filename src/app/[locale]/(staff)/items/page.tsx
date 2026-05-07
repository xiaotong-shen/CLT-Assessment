import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { items } from "../../../../../db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";

const STATUS_BADGE: Record<string, string> = {
  drafted: "bg-gray-100 text-gray-600",
  reviewed: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-800",
  retired: "bg-red-100 text-red-700",
};

export default async function ItemsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user || session.user.role === "student") {
    redirect(`/${locale}/login`);
  }

  const rows = await db
    .select({
      id: items.id,
      strand: items.strand,
      level: items.level,
      subskill: items.subskill,
      format: items.format,
      status: items.status,
      nAttempts: items.nAttempts,
    })
    .from(items)
    .orderBy(asc(items.strand), asc(items.level));

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Item Bank</h1>
            <p className="text-sm text-gray-500 mt-0.5">{rows.length} items</p>
          </div>
          <Link
            href={`/${locale}/queue`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Queue
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Strand", "Lvl", "Format", "Subskill", "Status", "Attempts", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 capitalize">{row.strand}</td>
                  <td className="px-4 py-3 text-gray-700">{row.level}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.format}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{row.subskill}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.nAttempts}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/items/${row.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No items yet. Run <code className="font-mono text-xs">pnpm db:seed</code> to load seed items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
