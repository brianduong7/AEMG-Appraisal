import { RatingGuideModalTrigger } from "@/components/rating-guide-modal";
import { RATING_LABELS, RATING_OPTIONS } from "@/lib/ratings";

export function RatingLegend() {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <p className="mb-2 font-semibold text-black">
        Suggested performance ratings (1–5)
      </p>
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
    </aside>
  );
}
