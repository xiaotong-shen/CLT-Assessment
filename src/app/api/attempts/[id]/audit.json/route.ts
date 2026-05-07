import { auth } from "@/server/auth";
import { getAuditJson } from "@/server/attempts";
import { NextResponse } from "next/server";

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
  const audit = await getAuditJson(id);

  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(audit);
}
