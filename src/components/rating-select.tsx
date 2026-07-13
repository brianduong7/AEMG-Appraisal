"use client";

import { ratingLabel, RATING_OPTIONS } from "@/lib/ratings";

type Props = {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Ratings are stored 1–5 but displayed as words only
 * (per review-process update: "remove numbers — to words").
 */
export function RatingSelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const selectValue = value == null ? "" : String(value);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <select
        id={id}
        className="w-full min-w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-navy-950 shadow-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      >
        <option value="">Select rating</option>
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {ratingLabel(n)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RatingReadOnly({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return (
    <span className="text-sm font-medium text-navy-950">
      {ratingLabel(value)}
    </span>
  );
}
