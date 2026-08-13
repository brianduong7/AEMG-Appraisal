import { NextResponse } from "next/server";
import {
  getFeedbackRequestByToken,
  submitFeedbackResponse,
} from "@/lib/erpnext-feedback";

/**
 * Reviewer-facing half of the feedback feature. Reached from a link, by
 * someone with no login - the token in the path IS the credential, so this
 * route is intentionally the only unauthenticated write surface in the app.
 *
 * Two properties this route is responsible for keeping:
 *
 *  - It never distinguishes an unknown token from a deleted or already-used
 *    one in its error text. All of those come back as one neutral "not
 *    valid" 404, so the endpoint can't be used to probe which requests
 *    exist.
 *  - It forwards no appraisal detail beyond what get_feedback_request
 *    already narrowed to. The employee's ratings and other reviewers'
 *    comments are never in scope here, and that is enforced server-side in
 *    the add-on rather than trusted to this layer.
 *
 * Not implemented here, and worth being explicit about: no rate limiting.
 * Tokens are 32-char hashes so guessing is impractical, but if this ever
 * moves somewhere more exposed than a dev App Service, that assumption
 * should be revisited rather than inherited.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await getFeedbackRequestByToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const comment = String((body as { comment?: unknown })?.comment ?? "").trim();
  if (!comment) {
    return NextResponse.json(
      { error: "Please enter your feedback before submitting." },
      { status: 400 }
    );
  }

  const result = await submitFeedbackResponse(token, comment);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
