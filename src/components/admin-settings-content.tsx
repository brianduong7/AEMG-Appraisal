"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_REVIEW_WINDOWS,
  type ReviewWindowSettings,
} from "@/lib/types";
import { viewSubtitle, viewTitle } from "@/lib/nav-roles";
import { useSession } from "@/contexts/session-context";
import { entityBrandColor, entityButtonStyle } from "@/lib/entity-theme";

/** AEMG's cycle runs August -> August, not the calendar year - matches erpAppraisalCycleLabel in home-content.tsx/erpnext.ts. */
function cycleSpanLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

function WindowRow({
  label,
  description,
  checked,
  busy,
  onChange,
  brandColor,
}: {
  label: string;
  description: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
  brandColor: string | null;
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
          checked ? "bg-navy-900" : "bg-slate-200"
        } disabled:opacity-50`}
        style={checked ? entityButtonStyle(brandColor) : undefined}
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
  const { user } = useSession();
  const brandColor = entityBrandColor(user?.entity);
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

  const [cycleBusy, setCycleBusy] = useState(false);
  const [cycleConfirm, setCycleConfirm] = useState(false);

  const startNextCycle = useCallback(async () => {
    setCycleBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startNextCycle: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string" ? body.error : "Could not start the next cycle."
        );
        return;
      }
      setWindows(body as ReviewWindowSettings);
      setCycleConfirm(false);
    } catch {
      setError("Network error.");
    } finally {
      setCycleBusy(false);
    }
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
              Appraisal cycle
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              New appraisals are created under this cycle. Existing appraisals keep
              their own cycle - starting a new one never affects past records.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-950">
                Current cycle: {cycleSpanLabel(windows.currentCycleYear)}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {cycleConfirm
                  ? `Start the ${cycleSpanLabel(windows.currentCycleYear + 1)} cycle now? This can't be undone.`
                  : `Advance to the ${cycleSpanLabel(windows.currentCycleYear + 1)} cycle when this year's appraisals are done.`}
              </p>
            </div>
            {cycleConfirm ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={cycleBusy}
                  onClick={() => setCycleConfirm(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={cycleBusy}
                  onClick={() => void startNextCycle()}
                  className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                  style={entityButtonStyle(brandColor)}
                >
                  {cycleBusy
                    ? "Starting…"
                    : `Confirm: start ${cycleSpanLabel(windows.currentCycleYear + 1)}`}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={cycleBusy}
                onClick={() => setCycleConfirm(true)}
                className="shrink-0 rounded-lg border border-navy-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition hover:border-navy-400 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start {cycleSpanLabel(windows.currentCycleYear + 1)} cycle →
              </button>
            )}
          </div>

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
              brandColor={brandColor}
            />
            <WindowRow
              label="Mid-Year Review"
              description="Unlock mid-year On Track ratings and manager comments"
              checked={windows.midYearReviewOpen}
              busy={busy}
              onChange={(v) => void patchWindow("midYearReviewOpen", v)}
              brandColor={brandColor}
            />
            <WindowRow
              label="Annual Review"
              description="Unlock annual self-ratings and manager ratings"
              checked={windows.annualReviewOpen}
              busy={busy}
              onChange={(v) => void patchWindow("annualReviewOpen", v)}
              brandColor={brandColor}
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
