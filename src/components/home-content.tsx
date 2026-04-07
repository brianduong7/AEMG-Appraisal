"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Appraisal } from "@/lib/types";
import {
  appraisalListDisplayName,
  entityShellClass,
} from "@/lib/entity-theme";
import { useRole } from "@/contexts/role-context";
import { useSession } from "@/contexts/session-context";

function statusBadge(status: Appraisal["status"]) {
  const map = {
    draft: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
    submitted: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
    reviewed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  };
  return map[status];
}

export function HomeContent() {
  const { user, logout, mode } = useSession();
  const { setRole } = useRole();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const [list, setList] = useState<Appraisal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
  }, [mode, setRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/appraisals");
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as Appraisal[];
        if (!cancelled) {
          setList(data);
        }
      } catch {
        if (!cancelled) setError("Could not load appraisals.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleAppraisals = useMemo(() => {
    if (!list) return null;
    if (mode === "employee" && user) {
      return list.filter(
        (a) => !a.ownerUserId || a.ownerUserId === user.id
      );
    }
    return list;
  }, [list, mode, user]);

  const sessionLabel =
    mode === "manager"
      ? "Manager (review all appraisals)"
      : user?.employeeName ?? "Employee";

  const themeEntity =
    mode === "employee" && user ? user.entity : null;

  return (
    <div
      className={`flex flex-1 flex-col ${entityShellClass(themeEntity)}`}
    >
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AEMG Appraisal
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {sessionLabel}
          </span>
          .
          {mode === "employee" && (
            <span>
              {" "}
              You can open and edit <strong>only your</strong> performance
              plan; after submit it becomes view-only for you.
            </span>
          )}
          {mode === "manager" && (
            <span>
              {" "}
              You can open any appraisal to review submitted plans.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-3 text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </header>

      {notice === "submitted" && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
          role="status"
        >
          Appraisal submitted. <strong>Manager has been notified.</strong>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {mode === "employee" ? "Your appraisal" : "All appraisals"}
        </h2>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!list && !error && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
        {list && list.length === 0 && (
          <p className="text-sm text-zinc-500">No appraisals yet.</p>
        )}
        {visibleAppraisals &&
          list &&
          list.length > 0 &&
          visibleAppraisals.length === 0 &&
          mode === "employee" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No appraisal is assigned to your account. Sign out and choose
              another demo employee, or ask an admin to link your plan.
            </p>
          )}
        {visibleAppraisals && visibleAppraisals.length > 0 && (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {visibleAppraisals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/appraisal/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {appraisalListDisplayName(
                      a,
                      mode ?? "employee",
                      user
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(a.status)}`}
                  >
                    {a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
