"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { RatingGuideModalTrigger } from "@/components/rating-guide-modal";
import { RATING_LABELS, RATING_OPTIONS } from "@/lib/ratings";

function RatingLegendBody() {
  return (
    <>
      <ul className="space-y-1.5 text-zinc-700">
        {RATING_OPTIONS.map((n) => (
          <li key={n}>
            <span className="font-medium tabular-nums">{n}.</span>{" "}
            {RATING_LABELS[n]}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-zinc-200 pt-3">
        <RatingGuideModalTrigger />
      </div>
    </>
  );
}

/** Full block with heading (e.g. inline aside). */
export function RatingLegendContent() {
  return (
    <>
      <p className="mb-2 font-semibold text-black">
        Suggested performance ratings (1–5)
      </p>
      <RatingLegendBody />
    </>
  );
}

/** Inline aside (legacy); prefer {@link RatingLegendModal} on narrow layouts. */
export function RatingLegend() {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <RatingLegendContent />
    </aside>
  );
}

export function RatingLegendModal({
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
        aria-labelledby="rating-legend-modal-title"
        className="fixed left-1/2 top-1/2 z-[200] flex max-h-[min(90vh,100dvh)] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-black shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <h2
            id="rating-legend-modal-title"
            className="text-lg font-semibold text-black"
          >
            Suggested performance ratings (1–5)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="rating-guide-dialog-scroll overflow-y-auto px-5 py-4 text-sm">
          <RatingLegendBody />
        </div>
      </div>
    </>,
    document.body
  );
}
