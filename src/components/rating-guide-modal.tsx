"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  RATING_GUIDE_BY_SCORE,
  RATING_GUIDE_INTRO,
} from "@/lib/rating-guide";
import { RATING_OPTIONS } from "@/lib/ratings";

type RatingGuideContextValue = {
  openRatingGuide: () => void;
};

const RatingGuideContext = createContext<RatingGuideContextValue | null>(null);

/**
 * Mount once near the app root. All `RatingGuideModalTrigger` buttons share one
 * modal. Uses a portal instead of `<dialog>` to avoid SSR/hydration mismatches
 * and double scrollbars from native dialog + inner overflow.
 */
export function RatingGuideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openRatingGuide = useCallback(() => setOpen(true), []);
  const closeRatingGuide = useCallback(() => setOpen(false), []);

  return (
    <RatingGuideContext.Provider value={{ openRatingGuide }}>
      {children}
      <RatingGuideDialog open={open} onClose={closeRatingGuide} />
    </RatingGuideContext.Provider>
  );
}

export function RatingGuideModalTrigger({
  className,
  label = "View full rating definitions",
}: {
  className?: string;
  label?: string;
}) {
  const ctx = useContext(RatingGuideContext);
  if (!ctx) {
    throw new Error(
      "RatingGuideModalTrigger must be used inside RatingGuideProvider"
    );
  }
  const { openRatingGuide } = ctx;

  return (
    <button
      type="button"
      onClick={openRatingGuide}
      className={
        className ??
        "text-sm font-medium text-sky-700 underline decoration-sky-700/40 underline-offset-2 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/40 dark:hover:decoration-sky-300"
      }
    >
      {label}
    </button>
  );
}

function RatingGuideDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[199] bg-black/45"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-guide-title"
        className="fixed left-1/2 top-1/2 z-[200] flex max-h-[min(90vh,100dvh)] w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2
            id="rating-guide-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
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
        <div className="rating-guide-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 pe-5">
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
          <div className="mt-6 flex justify-end pb-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
