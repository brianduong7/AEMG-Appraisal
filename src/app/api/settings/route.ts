import { NextResponse } from "next/server";
import {
  getReviewWindows,
  updateReviewWindows,
} from "@/lib/settings-store";
import type { ReviewWindowSettings } from "@/lib/types";

export async function GET() {
  const settings = await getReviewWindows();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<ReviewWindowSettings> = {};
  if (typeof o.kpiSubmissionOpen === "boolean") {
    patch.kpiSubmissionOpen = o.kpiSubmissionOpen;
  }
  if (typeof o.midYearReviewOpen === "boolean") {
    patch.midYearReviewOpen = o.midYearReviewOpen;
  }
  if (typeof o.annualReviewOpen === "boolean") {
    patch.annualReviewOpen = o.annualReviewOpen;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one window flag to update." },
      { status: 400 }
    );
  }
  const next = await updateReviewWindows(patch);
  return NextResponse.json(next);
}
