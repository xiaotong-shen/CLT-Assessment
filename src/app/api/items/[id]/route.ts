import "server-only";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { items } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ItemSchema } from "@/server/schemas/items";

const PatchSchema = z.object({
  level: z.number().int().min(1).max(5).optional(),
  subskill: z.string().min(1).optional(),
  status: z.enum(["drafted", "reviewed", "live", "retired"]).optional(),
  culturalContextFlag: z.boolean().optional(),
  estimatedTimeSec: z.number().int().positive().optional(),
  payload: z.unknown().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;

  // If payload is being updated, validate it against the full ItemSchema
  if (patch.payload !== undefined) {
    const [existing] = await db
      .select({ format: items.format })
      .from(items)
      .where(eq(items.id, id))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const check = ItemSchema.safeParse({
      id,
      strand: "reading",
      level: 1,
      subskill: "x",
      format: existing.format,
      payload: patch.payload,
    });
    if (!check.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: check.error.flatten() },
        { status: 400 }
      );
    }
  }

  const update: Partial<typeof items.$inferInsert> = {};
  if (patch.level !== undefined) update.level = patch.level;
  if (patch.subskill !== undefined) update.subskill = patch.subskill;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.culturalContextFlag !== undefined) update.culturalContextFlag = patch.culturalContextFlag;
  if (patch.estimatedTimeSec !== undefined) update.estimatedTimeSec = patch.estimatedTimeSec;
  if (patch.payload !== undefined) update.payload = patch.payload as Record<string, unknown>;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(items).set(update).where(eq(items.id, id));
  return NextResponse.json({ ok: true });
}
