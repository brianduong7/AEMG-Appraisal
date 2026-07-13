"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AppLogo } from "@/components/app-logo";
import { DEMO_BRANCH_MANAGER_COMMENT_REQUEST } from "@/lib/branch-manager-comment-form-demo";
import { formatDueDateDisplay } from "@/lib/format-date";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

export function BranchManagerCommentForm() {
  const ctx = DEMO_BRANCH_MANAGER_COMMENT_REQUEST;
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setSubmitted(true);
    }, 400);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-black">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <AppLogo variant="header" />
          <nav className="text-xs text-zinc-500" aria-label="Breadcrumb">
            <span className="font-medium text-black">Branch manager feedback</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <p className="mb-6 text-sm text-zinc-600">
          Demo: external link sent to a branch manager when line management
          requests branch-level input on an appraisal.
        </p>

        {submitted ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center shadow-sm"
            role="status"
          >
            <p className="text-lg font-semibold text-emerald-950">
              Thank you — your feedback has been recorded
            </p>
            <p className="mt-2 text-sm text-emerald-900">
              In production this would be saved against appraisal{" "}
              <strong>{ctx.appraisalDocId}</strong> and visible to HR on the KPI
              tab.
            </p>
            <button
              type="button"
              className="mt-6 text-sm font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-2"
              onClick={() => {
                setSubmitted(false);
                setFeedback("");
              }}
            >
              Submit another (demo)
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="mb-6 border-b border-zinc-100 pb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Feedback request
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-black">
                Branch manager comments
              </h1>
              <p className="mt-2 text-sm text-zinc-600">
                <strong>{ctx.requestedBy}</strong> ({ctx.requestedByRole}) has
                requested your input for{" "}
                <strong>{ctx.employeeName}</strong>&apos;s{" "}
                {ctx.appraisalCycle.toLowerCase()}.
              </p>
            </div>

            <dl className="mb-6 grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">Your branch</dt>
                <dd className="mt-0.5 font-medium text-black">{ctx.branch}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">
                  You are signed in as
                </dt>
                <dd className="mt-0.5 font-medium text-black">
                  {ctx.branchManagerName} · {ctx.branchManagerRole}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Employee</dt>
                <dd className="mt-0.5 text-black">{ctx.employeeName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Position</dt>
                <dd className="mt-0.5 text-black">
                  {ctx.position} — {ctx.department}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">
                  Appraisal reference
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-black">
                  {ctx.appraisalDocId}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">
                  Respond by
                </dt>
                <dd className="mt-0.5 text-black">
                  {formatDueDateDisplay(ctx.dueDate)}
                </dd>
              </div>
            </dl>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="branch-feedback"
                  className="mb-1.5 block text-sm font-medium text-black"
                >
                  Your feedback
                </label>
                <p className="mb-2 text-sm text-zinc-600">{ctx.feedbackPrompt}</p>
                <textarea
                  id="branch-feedback"
                  required
                  rows={6}
                  className={`${inputClass} min-h-[140px] resize-y`}
                  placeholder="Share observations on performance, teamwork, and branch impact…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
                <button
                  type="submit"
                  disabled={busy || !feedback.trim()}
                  className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Submitting…" : "Submit feedback"}
                </button>
                <Link
                  href="/"
                  className="text-sm font-medium text-zinc-600 hover:text-black"
                >
                  Back to appraisals
                </Link>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
