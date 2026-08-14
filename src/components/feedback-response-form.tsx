"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppLogo } from "@/components/app-logo";
import type { FeedbackRequestContext } from "@/lib/erpnext-feedback";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

/**
 * The page an outside reviewer lands on from their link. They have no
 * login: the token in the URL is the whole credential, so this screen
 * shows only what `get_feedback_request` narrowed it to - who asked, about
 * whom, for which cycle. Never the employee's ratings, scores, or anyone
 * else's comments.
 *
 * Note there is no "submit another" affordance, unlike the mockup this
 * replaces: one answer per link is enforced server-side, so offering it
 * would just produce an error. A manager wanting more input raises a new
 * request instead.
 */
export function FeedbackResponseForm({ token }: { token: string }) {
  const [context, setContext] = useState<FeedbackRequestContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(token)}`);
      const data = (await res.json()) as
        | FeedbackRequestContext
        | { error?: string };
      if (!res.ok) {
        setLoadError(
          ("error" in data && data.error) || "This feedback link is not valid."
        );
        return;
      }
      setContext(data as FeedbackRequestContext);
    } catch {
      setLoadError("Could not load this feedback request. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim() || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not submit your feedback.");
        return;
      }
      setJustSubmitted(true);
    } catch {
      setSubmitError("Could not submit your feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-black">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <AppLogo variant="header" />
          <nav className="text-xs text-zinc-500" aria-label="Breadcrumb">
            <span className="font-medium text-black">Feedback request</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {loading ? (
          <p className="text-sm text-zinc-600" role="status">
            Loading your feedback request…
          </p>
        ) : loadError ? (
          <div
            className="rounded-xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm"
            role="alert"
          >
            <p className="text-lg font-semibold text-black">
              This link is not valid
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
              {loadError} It may have been withdrawn, or the address may have
              been copied incompletely. Please check with the person who sent
              it to you.
            </p>
          </div>
        ) : justSubmitted || context?.alreadySubmitted ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center shadow-sm"
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-950">
              {justSubmitted
                ? "Thank you — your feedback has been recorded"
                : "Your feedback has already been submitted"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-emerald-900">
              {justSubmitted
                ? "It has been saved against this appraisal and is now visible to the employee's manager and HR."
                : "This link accepts one response, and yours is already recorded. Contact the person who sent it if you need to change anything."}
            </p>
          </div>
        ) : context ? (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="mb-6 border-b border-zinc-100 pb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Feedback request
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-black">
                {context.employeeName
                  ? `Your feedback on ${context.employeeName}`
                  : "Your feedback"}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                {context.requestedByName ? (
                  <>
                    <strong>{context.requestedByName}</strong> has requested
                    your input
                  </>
                ) : (
                  "Your input has been requested"
                )}
                {context.employeeName ? (
                  <>
                    {" "}
                    for <strong>{context.employeeName}</strong>&apos;s
                  </>
                ) : (
                  " for the"
                )}{" "}
                {(context.appraisalCycle ?? "appraisal").toLowerCase()}.
              </p>
            </div>

            <dl className="mb-6 grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">
                  This request is for
                </dt>
                <dd className="mt-0.5 font-medium text-black">
                  {context.reviewerName}
                  {context.reviewerRole ? ` · ${context.reviewerRole}` : ""}
                </dd>
              </div>
              {context.reviewerBranch && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Branch</dt>
                  <dd className="mt-0.5 text-black">{context.reviewerBranch}</dd>
                </div>
              )}
              {context.employeeName && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Employee</dt>
                  <dd className="mt-0.5 text-black">{context.employeeName}</dd>
                </div>
              )}
              {(context.position || context.department) && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Position</dt>
                  <dd className="mt-0.5 text-black">
                    {[context.position, context.department]
                      .filter(Boolean)
                      .join(" — ")}
                  </dd>
                </div>
              )}
            </dl>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="reviewer-feedback"
                  className="mb-1.5 block text-sm font-medium text-black"
                >
                  Your feedback
                </label>
                <p className="mb-2 text-sm text-zinc-600">
                  Please share your perspective on this employee&apos;s
                  performance, collaboration, and impact during this appraisal
                  cycle.
                </p>
                <textarea
                  id="reviewer-feedback"
                  required
                  rows={6}
                  className={`${inputClass} min-h-[140px] resize-y`}
                  placeholder="Share observations on performance, teamwork, and impact…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  You can submit once. Your response is visible to the
                  employee&apos;s manager and HR, and is not shown to the
                  employee.
                </p>
              </div>

              {submitError && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {submitError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
                <button
                  type="submit"
                  disabled={busy || !comment.trim()}
                  className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Submitting…" : "Submit feedback"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
