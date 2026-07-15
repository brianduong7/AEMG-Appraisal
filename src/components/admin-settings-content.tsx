"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_REVIEW_WINDOWS,
  type ReviewWindowSettings,
} from "@/lib/types";
import { viewSubtitle, viewTitle } from "@/lib/nav-roles";

function WindowRow({
  label,
  description,
  checked,
  busy,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy-950">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-navy-800" : "bg-slate-200"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/** HR-only settings page body (rendered inside HomeContent when view=settings). */
export function AdminSettingsPanel() {
  const [windows, setWindows] = useState<ReviewWindowSettings>(
    DEFAULT_REVIEW_WINDOWS
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const body = (await res.json()) as ReviewWindowSettings;
        if (!cancelled) {
          setWindows(body);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchWindow = useCallback(
    async (key: keyof ReviewWindowSettings, value: boolean) => {
      setBusy(true);
      setError(null);
      const prev = windows;
      setWindows({ ...windows, [key]: value });
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setWindows(prev);
          setError(
            typeof body?.error === "string" ? body.error : "Update failed."
          );
          return;
        }
        setWindows(body as ReviewWindowSettings);
      } catch {
        setWindows(prev);
        setError("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [windows]
  );

  return (
    <section
      aria-label="Admin settings"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-navy-950">
          {viewTitle("settings")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {viewSubtitle("settings")}
        </p>
      </div>

      {!loaded && (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          Loading…
        </p>
      )}

      {loaded && (
        <>
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Review windows
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Lock or unlock each phase of the appraisal cycle for employees and
              managers.
            </p>
          </div>
          <div>
            <WindowRow
              label="KPI submission"
              description="Employees can submit beginning-of-year KPIs"
              checked={windows.kpiSubmissionOpen}
              busy={busy}
              onChange={(v) => void patchWindow("kpiSubmissionOpen", v)}
            />
            <WindowRow
              label="Mid-Year Review"
              description="Unlock mid-year On Track ratings and manager comments"
              checked={windows.midYearReviewOpen}
              busy={busy}
              onChange={(v) => void patchWindow("midYearReviewOpen", v)}
            />
            <WindowRow
              label="Annual Review"
              description="Unlock annual self-ratings and manager ratings"
              checked={windows.annualReviewOpen}
              busy={busy}
              onChange={(v) => void patchWindow("annualReviewOpen", v)}
            />
          </div>
          {error && (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
