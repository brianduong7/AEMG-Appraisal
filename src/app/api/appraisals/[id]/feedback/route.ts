import { NextResponse } from "next/server";
import { getAppraisal } from "@/lib/appraisal-store";
import {
  createFeedbackRequest,
  deleteFeedbackRequest,
  listFeedbackRequests,
} from "@/lib/erpnext-feedback";

/**
 * Manager/HR side of third-party feedback requests. The reviewer-facing
 * half lives at /api/feedback/[token] and is deliberately separate: this
 * route is about an appraisal a signed-in user is already looking at, that
 * one is about a bare token held by someone with no login at all.
 *
 * Role gating is client-side, in the appraisal detail UI, which only shows
 * these controls to a manager or HR - the same (only) access-control model
 * every other action in this prototype uses, since there is no real login
 * yet. ERPNext re-checks manager-or-HR server side, but under the shared
 * service account that check can't tell demo users apart, so it is a
 * backstop rather than the real gate. Worth revisiting when Entra login
 * lands and the app finally knows who is actually calling.
 */

async function ownerUserIdFor(id: string): Promise<string | null> {
  const appraisal = await getAppraisal(id);
  return appraisal?.ownerUserId ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerUserId = await ownerUserIdFor(id);
  if (!ownerUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await listFeedbackRequests(ownerUserId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerUserId = await ownerUserIdFor(id);
  if (!ownerUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const reviewerName = String(b.reviewerName ?? "").trim();
  if (!reviewerName) {
    return NextResponse.json(
      { error: "Reviewer name is required." },
      { status: 400 }
    );
  }

  const result = await createFeedbackRequest(ownerUserId, {
    reviewerName,
    reviewerRole: String(b.reviewerRole ?? "").trim() || undefined,
    reviewerBranch: String(b.reviewerBranch ?? "").trim() || undefined,
    requestedByName: String(b.requestedByName ?? "").trim() || undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ownerUserId = await ownerUserIdFor(id);
  if (!ownerUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json(
      { error: "Feedback request name is required." },
      { status: 400 }
    );
  }

  const result = await deleteFeedbackRequest(name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result.data);
}
