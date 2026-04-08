"use client";

import { ratingLabel, RATING_OPTIONS } from "@/lib/ratings";

type Props = {
  id?: string;
  value: number;
  onChange: (n: number) => void;
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
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <select
        id={id}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="text-sm text-zinc-600">
        {ratingLabel(value)}
      </span>
    </div>
  );
}

export function RatingReadOnly({ value }: { value: number }) {
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
