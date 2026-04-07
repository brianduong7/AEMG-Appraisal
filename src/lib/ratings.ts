/** Suggested performance ratings (1–5) — aligned with Annual Performance Plan. */
export const RATING_LABELS: Record<number, string> = {
  1: "Does not meet expectations",
  2: "Needs improvement",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

export const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function ratingLabel(score: number): string {
  return RATING_LABELS[score] ?? "—";
}
