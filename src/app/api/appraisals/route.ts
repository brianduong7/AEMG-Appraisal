import { NextResponse } from "next/server";
import { createAppraisal, readAppraisals } from "@/lib/appraisal-store";
import { findMockUser } from "@/lib/mock-users";

export async function GET() {
  const appraisals = await readAppraisals();
  return NextResponse.json(appraisals);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ownerUserId = String(
    (body as { ownerUserId?: unknown }).ownerUserId ?? ""
  ).trim();
  if (!ownerUserId || !findMockUser(ownerUserId)) {
    return NextResponse.json({ error: "Invalid ownerUserId" }, { status: 400 });
  }
  try {
    const appraisal = await createAppraisal(ownerUserId);
    return NextResponse.json(appraisal, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
