import { auth } from "@/server/auth";
import { createAttempt } from "@/server/attempts";
import { NextResponse } from "next/server";
import { z } from "zod";

const IntakeBodySchema = z.object({
  intake: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const session = await auth();
  const body = await req.json().catch(() => null);
  const parsed = IntakeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const attemptId = await createAttempt(parsed.data.intake, session?.user?.id);
  return NextResponse.json({ attemptId }, { status: 201 });
}
