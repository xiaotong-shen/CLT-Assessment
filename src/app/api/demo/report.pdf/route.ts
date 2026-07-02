/**
 * POST /api/demo/report.pdf
 * Body: { recommendation, studentName?, assessmentDate? }
 * Returns: application/pdf — a standalone, server-generated placement report.
 *
 * Decoupled from the website: the client posts the recommendation it already
 * holds in memory, and gets back a real vector PDF to download. No DB, no
 * headless browser.
 */
import { z } from "zod";
import { renderReportPdf } from "@/server/report-pdf";
import type { Recommendation } from "@/engine/types";

export const runtime = "nodejs";

const BodySchema = z.object({
  recommendation: z.custom<Recommendation>(),
  studentName: z.string().optional(),
  assessmentDate: z.string().optional(),
  assessedStrands: z
    .array(z.enum(["reading", "listening", "grammar", "writing"]))
    .optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { recommendation, studentName, assessmentDate, assessedStrands } = parsed.data;

  const pdf = await renderReportPdf({
    rec: recommendation,
    studentName: studentName?.trim() || "Student",
    assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
    assessedStrands,
  });

  const safeName = (studentName || "student").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="placement-report-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
