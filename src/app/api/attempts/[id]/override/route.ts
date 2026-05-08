import "server-only";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { attempts, recommendationOverrides } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

const OverrideBodySchema = z.object({
  course: z.string().min(1),
  stream: z.enum(["esl", "mainstream"]),
  reason: z.string().min(1).max(1000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, id))
    .limit(1);

  if (!attempt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (attempt.status !== "complete") {
    return NextResponse.json(
      { error: "Can only override completed attempts" },
      { status: 400 }
    );
  }
  if (!attempt.recommendation) {
    return NextResponse.json(
      { error: "No recommendation to override" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = OverrideBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { course, stream, reason } = parsed.data;

  await db.insert(recommendationOverrides).values({
    id: createId(),
    attemptId: id,
    specialistId: session.user.id!,
    original: attempt.recommendation as Record<string, unknown>,
    override: { course, stream },
    reason,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [latest] = await db
    .select()
    .from(recommendationOverrides)
    .where(eq(recommendationOverrides.attemptId, id))
    .orderBy(recommendationOverrides.createdAt)
    .limit(1);

  return NextResponse.json({ override: latest ?? null });
}
