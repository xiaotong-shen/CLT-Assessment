import { getNextItem } from "@/server/attempts";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getNextItem(id);

  if (result === null) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  if ("done" in result) {
    return NextResponse.json({ done: true });
  }

  return NextResponse.json(result);
}
