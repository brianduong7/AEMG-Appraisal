"use client";

import { ratingLabel, RATING_OPTIONS } from "@/lib/ratings";

type Props = {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
  className?: string;
};

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
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black"
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      >
        <option value="">Select</option>
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {value != null && (
        <span className="text-sm text-zinc-600">{ratingLabel(value)}</span>
      )}
    </div>
  );
}

export function RatingReadOnly({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-zinc-400">—</span>;
  }
  return (
    <span className="text-sm">
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-zinc-600">
        {" "}
        — {ratingLabel(value)}
      </span>
    </span>
  );
}
