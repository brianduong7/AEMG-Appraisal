"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  APPENDIX_LEVELS_DESCENDING,
  FRAMEWORK_BY_LEVEL,
  capabilityTitle,
  typicalRoleForMLevel,
} from "@/lib/capability-framework";
import { CAPABILITY_ORDER, type CapabilityId } from "@/lib/types";

/**
 * Full Appendix 1 — AEMG Capability Framework reference (read-only).
 * Styled to match the orange header + alternating row bands.
 */
export function CapabilityAppendixReference({
  embedded = false,
}: {
  /** Hide top title strip when used inside {@link CapabilityAppendixModal}. */
  embedded?: boolean;
} = {}) {
  return (
    <div className={`rounded-lg bg-white ${embedded ? "" : "border border-zinc-200"}`}>
      {!embedded && (
        <div className="border-b border-black px-4 py-3">
          <h3 className="text-base font-bold text-black">
            Appendix 1 — AEMG Capability Framework
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            Reference only. Ratings above use the row that matches the
            employee&apos;s M level.
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-4xl border-collapse text-left text-xs text-black">
          <thead>
            <tr className="bg-orange-500 text-white">
              <th className="border border-black px-2 py-2 font-bold whitespace-nowrap">
                Level
              </th>
              <th className="border border-black px-2 py-2 font-bold min-w-40">
                Typical Role
              </th>
              {CAPABILITY_ORDER.map((id: CapabilityId) => (
                <th
                  key={id}
                  className="border border-black px-2 py-2 font-bold min-w-44"
                >
                  {capabilityTitle(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPENDIX_LEVELS_DESCENDING.map((level) => {
              const row = FRAMEWORK_BY_LEVEL[level];
              const bandEven = level % 2 === 0;
              return (
                <tr
                  key={level}
                  className={bandEven ? "bg-orange-50/90" : "bg-white"}
                >
                  <td className="border border-black px-2 py-2 align-top font-semibold whitespace-nowrap">
                    {level}
                  </td>
                  <td className="border border-black px-2 py-2 align-top leading-snug">
                    {typicalRoleForMLevel(level)}
                  </td>
                  {CAPABILITY_ORDER.map((id: CapabilityId) => (
                    <td
                      key={id}
                      className="border border-black px-2 py-2 align-top leading-snug"
                    >
                      {row?.[id] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CapabilityAppendixModal({
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
        aria-labelledby="cap-appendix-modal-title"
        className="fixed left-1/2 top-1/2 z-[200] flex max-h-[min(92vh,100dvh)] w-[min(calc(100vw-2rem),72rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-black shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2
              id="cap-appendix-modal-title"
              className="text-lg font-semibold text-black"
            >
              Appendix 1 — AEMG Capability Framework
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Reference only. Ratings use the row that matches the employee&apos;s
              M level.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="rating-guide-dialog-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <CapabilityAppendixReference embedded />
        </div>
      </div>
    </>,
    document.body
  );
}
