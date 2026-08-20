import { NextResponse } from "next/server";
import { advanceCycle, getWindows, setWindows } from "@/lib/settings-source";
import { resolveActor } from "@/lib/appraisal-actor";
import { statusForError, writesToErpnext } from "@/lib/appraisal-source";
import type { ReviewWindowSettings } from "@/lib/types";

export async function GET() {
  const settings = await getWindows();
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

  /* Cycle advancement is a distinct, deliberate action - not a raw field
     patch (that would let a client set currentCycleYear to anything). */
  // HR-only, enforced by ERPNext against the acting identity. The route
  // previously had no check at all - the Admin Settings page simply is not
  // rendered for non-HR, which is a UI convenience, not authorization.
  const actor = await resolveActor(
    new URL(request.url).searchParams.get("as")
  );
  if (writesToErpnext() && !actor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (o.startNextCycle === true) {
    try {
      return NextResponse.json(await advanceCycle(actor));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start the cycle.";
      return NextResponse.json({ error: msg }, { status: statusForError(e) });
    }
  }

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
  try {
    return NextResponse.json(await setWindows(actor, patch));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update windows.";
    return NextResponse.json({ error: msg }, { status: statusForError(e) });
  }
}
