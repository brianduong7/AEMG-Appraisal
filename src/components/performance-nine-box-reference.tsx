"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Reference: suggested 9-point performance grid (performance × capability / behaviour).
 * Read-only; scores in titles match the framework document.
 */

const INTRO =
  "A nine-point performance rating grid enables clearer distinction between role performance and capability, skills and behaviours. This approach supports a more balanced and meaningful assessment of employee outcomes, considering both what results are delivered and how those results are achieved.";

type Cell = { scoreTitle: string; body: string };

/** Rows top → bottom: high → low capability. Columns left → right: low → high performance. */
const GRID: Cell[][] = [
  [
    {
      scoreTitle: "(2) Values led contributor",
      body: "Demonstrates strong behaviours and capability. Results not yet meeting expectations. Focus on removing barriers and clarifying priorities.",
    },
    {
      scoreTitle: "(4) High potential",
      body: "Strong behaviours and capability. Performance impacted by role complexity, scale, or experience. Clear development opportunity.",
    },
    {
      scoreTitle: "(5) High performer",
      body: "Consistently exceeds expectations. Role model behaviours and strong leadership impact. Ready for progression or increased scope.",
    },
  ],
  [
    {
      scoreTitle: "(2) Developing performer",
      body: "Shows potential but performance is inconsistent. Requires targeted support and development.",
    },
    {
      scoreTitle: "(3) Solid contributor",
      body: "Reliably meets expectations. Demonstrates required behaviours. Effective and stable in role.",
    },
    {
      scoreTitle: "(4) Strong performer",
      body: "Delivers strong results consistently. Some capability or behaviour gaps. Development focus to sustain performance.",
    },
  ],
  [
    {
      scoreTitle: "(1) Not performing",
      body: "Not meeting role expectations. Behaviour and capability gaps evident. Requires structured performance improvement plan.",
    },
    {
      scoreTitle: "(3) Inconsistent contributor",
      body: "Performance and behaviours are variable. Requires close management and capability uplift.",
    },
    {
      scoreTitle: "(3) Results over behaviour",
      body: "Achieves results, but with behaviour or capability concerns. Potential cultural or team impact. Behavioural improvement required.",
    },
  ],
];

const ROW_LABELS = [
  "High — capability, skills and behaviour",
  "Medium — capability, skills and behaviour",
  "Low — capability, skills and behaviour",
] as const;

const COL_LABELS = [
  "Low performance",
  "Medium performance",
  "High performance",
] as const;

const axisCell =
  "bg-sky-100 px-2 py-2 text-center text-xs font-semibold text-black align-middle border border-zinc-300";
const cornerCell =
  "bg-sky-100 px-2 py-2 text-center text-[11px] font-semibold leading-tight text-black border border-zinc-300 min-w-[7rem]";
const dataCell =
  "border border-zinc-300 bg-white px-3 py-3 text-center align-top";

export function PerformanceNineBoxReference({
  embedded = false,
}: {
  /** Hide top heading when shown inside {@link PerformanceNineBoxModal}. */
  embedded?: boolean;
} = {}) {
  return (
    <div>
      {!embedded && (
        <h3 className="text-base font-bold text-black">
          Suggested performance ratings — additional option
        </h3>
      )}
      <p
        className={`text-sm leading-relaxed text-zinc-700 ${embedded ? "" : "mt-3"}`}
      >
        {INTRO}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-176 border-collapse text-sm text-black">
          <thead>
            <tr>
              <th className={cornerCell} scope="col">
                <span className="block text-zinc-600 font-normal text-[10px] uppercase tracking-wide">
                  Reference grid
                </span>
                Performance →
              </th>
              {COL_LABELS.map((label) => (
                <th key={label} className={axisCell} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID.map((row, ri) => (
              <tr key={ROW_LABELS[ri]}>
                <th className={`${axisCell} text-left sm:text-center`} scope="row">
                  <span className="block text-[10px] font-normal text-zinc-600 uppercase tracking-wide mb-1">
                    Capability, skills and behaviour
                  </span>
                  {ROW_LABELS[ri]}
                </th>
                {row.map((cell) => (
                  <td key={cell.scoreTitle} className={dataCell}>
                    <p className="font-bold text-black">{cell.scoreTitle}</p>
                    <p className="mt-2 text-left text-xs leading-relaxed text-zinc-700">
                      {cell.body}
                    </p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Reference only. Formal ratings use the KPI and Capability sections above.
      </p>
    </div>
  );
}

export function PerformanceNineBoxModal({
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
        aria-labelledby="nine-box-modal-title"
        className="fixed left-1/2 top-1/2 z-[200] flex max-h-[min(92vh,100dvh)] w-[min(calc(100vw-2rem),56rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-black shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <h2 id="nine-box-modal-title" className="text-lg font-semibold">
            9-point performance grid (reference)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="rating-guide-dialog-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <PerformanceNineBoxReference embedded />
        </div>
      </div>
    </>,
    document.body
  );
}
