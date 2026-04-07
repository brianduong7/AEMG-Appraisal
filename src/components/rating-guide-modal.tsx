"use client";

import { useEffect, useRef, useState } from "react";
import {
  RATING_GUIDE_BY_SCORE,
  RATING_GUIDE_INTRO,
} from "@/lib/rating-guide";
import { RATING_OPTIONS } from "@/lib/ratings";

export function RatingGuideModalTrigger({
  className,
  label = "View full rating definitions",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-sm font-medium text-sky-700 underline decoration-sky-700/40 underline-offset-2 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/40 dark:hover:decoration-sky-300"
        }
      >
        {label}
      </button>
      <RatingGuideDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function RatingGuideDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="max-h-[90vh] w-[min(100%-2rem,42rem)] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Suggested performance ratings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {RATING_GUIDE_INTRO}
        </p>
        <div className="space-y-6">
          {RATING_OPTIONS.map((n) => {
            const entry = RATING_GUIDE_BY_SCORE[n];
            if (!entry) return null;
            return (
              <section
                key={n}
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/50"
              >
                <h3 className="border-b border-zinc-200 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-950 dark:border-zinc-600 dark:bg-sky-950/60 dark:text-sky-100">
                  <span className="tabular-nums">{n}.</span> {entry.title}
                </h3>
                <ul className="list-disc space-y-2 px-6 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.bullets.map((b, i) => (
                    <li key={i} className="ms-1 ps-1">
                      {b}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
