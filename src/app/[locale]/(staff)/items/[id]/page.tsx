import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import { items } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ItemEditForm } from "./ItemEditForm";

export default async function ItemEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;

  if (!session?.user || session.user.role === "student") {
    redirect(`/${locale}/login`);
  }

  const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!item) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/${locale}/items`} className="text-sm text-blue-600 hover:underline">
            ← Items
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-mono text-xs text-gray-400">{item.id}</span>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">
            {item.strand} · Level {item.level} · {item.format}
          </h1>
          <p className="text-sm text-gray-500 mb-6">{item.subskill}</p>
          <ItemEditForm item={item} locale={locale} />
        </div>
      </div>
    </main>
  );
}
