import "server-only";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { attempts, attemptItems, items } from "../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { translateBatch } from "@/server/translate";
import type { Recommendation } from "@/engine/types";

const RequestSchema = z.object({
  targetLang: z.string().min(2).max(20).default("zh-Hans"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!attempt.recommendation) {
    return NextResponse.json({ error: "No recommendation" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  const targetLang = parsed.success ? parsed.data.targetLang : "zh-Hans";

  const rec = attempt.recommendation as Recommendation;

  // Collect all strings to translate in one batch
  const reasoning = rec.reasoning ?? [];
  const flagDetails = rec.flags.map((f) => f.detail);

  // Essay grading strings from the attempt items
  const essayRows = await db
    .select({ ai: attemptItems })
    .from(attemptItems)
    .leftJoin(items, eq(attemptItems.itemId, items.id))
    .where(eq(attemptItems.attemptId, id));

  const essayRow = essayRows.find(
    (r) =>
      (r.ai.response as Record<string, unknown> | null)?.grading !== undefined
  );
  const grading = essayRow
    ? ((r: typeof essayRow) => {
        const g = (r.ai.response as Record<string, unknown>)?.grading as
          | {
              scoredTraits: { trait: string; score: number; rationale: string }[];
              modelRationale: string;
            }
          | undefined;
        return g;
      })(essayRow)
    : undefined;

  const traitRationales = grading?.scoredTraits.map((t) => t.rationale) ?? [];
  const modelRationale = grading?.modelRationale ? [grading.modelRationale] : [];

  // Build flat array for batch translation
  const allTexts = [
    ...reasoning,
    ...flagDetails,
    ...traitRationales,
    ...modelRationale,
  ];

  if (allTexts.length === 0) {
    return NextResponse.json({
      reasoning: [],
      flagDetails: [],
      traitRationales: [],
      modelRationale: null,
    });
  }

  const translated = await translateBatch(allTexts, targetLang);

  // Slice back into named groups
  let offset = 0;
  const translatedReasoning = translated.slice(offset, (offset += reasoning.length));
  const translatedFlagDetails = translated.slice(offset, (offset += flagDetails.length));
  const translatedTraitRationales = translated.slice(offset, (offset += traitRationales.length));
  const translatedModelRationale = translated.slice(offset, (offset += modelRationale.length));

  return NextResponse.json({
    reasoning: translatedReasoning,
    flagDetails: translatedFlagDetails,
    traitRationales: translatedTraitRationales,
    modelRationale: translatedModelRationale[0] ?? null,
  });
}
