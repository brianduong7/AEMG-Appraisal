"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appraisal } from "@/lib/types";
import {
  appraisalListDisplayName,
  entityShellClass,
} from "@/lib/entity-theme";
import { MOCK_USERS } from "@/lib/mock-users";
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

type ManagerNotification = {
  id: string;
  appraisalId: string;
  employeeName: string;
  createdAt: string;
};

export function HomeContent() {
  const router = useRouter();
  const { user, logout, mode, managerProfile } = useSession();
  const { setRole } = useRole();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const [list, setList] = useState<Appraisal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ManagerNotification[]>(
    []
  );
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [managerCreateOwnerId, setManagerCreateOwnerId] = useState(
    MOCK_USERS[0]?.id ?? "emma"
  );

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/appraisals");
    if (!res.ok) throw new Error("Failed to load");
    const data = (await res.json()) as Appraisal[];
    setList(data);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (mode !== "manager" || !managerProfile) {
      setNotifications([]);
      return;
    }
    const res = await fetch(
      `/api/notifications?managerId=${encodeURIComponent(managerProfile.id)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as ManagerNotification[];
    setNotifications(data);
  }, [mode, managerProfile]);

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
  }, [mode, setRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshList();
        if (cancelled) return;
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load appraisals.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshNotifications();
      } catch {
        if (!cancelled) setNotifications([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNotifications]);

  async function createAppraisalForOwner(ownerUserId: string) {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(
          typeof body?.error === "string" ? body.error : "Could not create."
        );
        return;
      }
      await refreshList();
      await refreshNotifications();
      const appraisal = body as Appraisal;
      router.push(`/appraisal/${appraisal.id}`);
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreateBusy(false);
    }
  }

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
    mode === "manager" && managerProfile
      ? `${managerProfile.displayName} (manager)`
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
              Create a performance plan, edit drafts, and submit for manager
              review.
            </span>
          )}
          {mode === "manager" && (
            <span>
              {" "}
              Create drafts for any demo employee, review submissions, and use
              notifications for plans waiting on you.
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

      {mode === "manager" && notifications.length > 0 && (
        <section
          className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/50 dark:bg-amber-950/30"
          aria-label="Review notifications"
        >
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Pending your review
          </h2>
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/appraisal/${n.appraisalId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white px-3 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100/80 dark:border-amber-800/50 dark:bg-zinc-950 dark:text-amber-50 dark:hover:bg-amber-950/40"
                >
                  <span>
                    <strong>{n.employeeName}</strong> submitted an appraisal
                  </span>
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          New appraisal
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Emma&apos;s plans default to <strong>Emma</strong> as employee and{" "}
          <strong>Mark</strong> as manager (Mark gets an in-app alert on
          submit). Mark&apos;s own plan uses <strong>Mark</strong> and manager{" "}
          <strong>David Park</strong> (no demo login for David — submit still
          records the handoff for a real system).
        </p>
        {mode === "employee" && user && (
          <button
            type="button"
            disabled={createBusy}
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => createAppraisalForOwner(user.id)}
          >
            {createBusy ? "Creating…" : "Create appraisal for me"}
          </button>
        )}
        {mode === "manager" && (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="create-for"
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Employee
              </label>
              <select
                id="create-for"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                value={managerCreateOwnerId}
                onChange={(e) => setManagerCreateOwnerId(e.target.value)}
              >
                {MOCK_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.employeeName} — {u.position}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={createBusy}
              className="shrink-0 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              onClick={() => createAppraisalForOwner(managerCreateOwnerId)}
            >
              {createBusy ? "Creating…" : "Create appraisal"}
            </button>
          </div>
        )}
        {createError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {createError}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {mode === "employee" ? "Your appraisals" : "All appraisals"}
        </h2>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!list && !error && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
        {list && list.length === 0 && (
          <p className="text-sm text-zinc-500">
            No appraisals yet. Use <strong>New appraisal</strong> above.
          </p>
        )}
        {visibleAppraisals &&
          list &&
          list.length > 0 &&
          visibleAppraisals.length === 0 &&
          mode === "employee" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No appraisal is assigned to your account. Create one above or
              sign in as another demo employee.
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
