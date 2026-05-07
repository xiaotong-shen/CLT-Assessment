import "server-only";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { items } from "../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const strand = url.searchParams.get("strand");
  const status = url.searchParams.get("status");

  type Strand = "reading" | "listening" | "grammar" | "writing";
  type Status = "drafted" | "reviewed" | "live" | "retired";

  const VALID_STRANDS: Strand[] = ["reading", "listening", "grammar", "writing"];
  const VALID_STATUSES: Status[] = ["drafted", "reviewed", "live", "retired"];

  const conditions = [];
  if (strand && VALID_STRANDS.includes(strand as Strand)) {
    conditions.push(eq(items.strand, strand as Strand));
  }
  if (status && VALID_STATUSES.includes(status as Status)) {
    conditions.push(eq(items.status, status as Status));
  }

  const rows = await db
    .select({
      id: items.id,
      strand: items.strand,
      level: items.level,
      subskill: items.subskill,
      format: items.format,
      status: items.status,
      culturalContextFlag: items.culturalContextFlag,
      estimatedTimeSec: items.estimatedTimeSec,
      nAttempts: items.nAttempts,
    })
    .from(items)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(items.strand, items.level);

  return NextResponse.json(rows);
}
