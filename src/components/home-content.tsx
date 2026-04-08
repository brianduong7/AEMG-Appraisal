"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appraisal } from "@/lib/types";
import { appraisalListDisplayName } from "@/lib/entity-theme";
import { MOCK_USERS } from "@/lib/mock-users";
import { useRole } from "@/contexts/role-context";
import { useSession } from "@/contexts/session-context";
import { saveAppraisalBootstrap } from "@/lib/appraisal-bootstrap";
import { HeaderNotificationsButton } from "@/components/header-notifications-button";

function statusBadge(status: Appraisal["status"]) {
  const map = {
    draft: "bg-zinc-200 text-black",
    submitted: "bg-sky-100 text-sky-900",
    reviewed: "bg-emerald-100 text-emerald-900",
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
      saveAppraisalBootstrap(appraisal);
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

  const chromeInitial =
    (mode === "employee" && user?.employeeName?.[0]?.toUpperCase()) ||
    (mode === "manager" && managerProfile?.displayName?.[0]?.toUpperCase()) ||
    "A";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-black">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <nav
            className="text-xs text-zinc-500"
            aria-label="Breadcrumb"
          >
            <span className="font-medium text-black">
              Performance
            </span>
            <span className="mx-1.5 text-zinc-300">/</span>
            <span className="text-zinc-500">Appraisal</span>
          </nav>
          <div className="ml-auto flex min-w-48 max-w-xl flex-1 items-center justify-end gap-3">
            <input
              type="search"
              readOnly
              placeholder="Search or type a command (⌘ + G)"
              className="hidden w-full max-w-md rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 md:block"
              aria-hidden
            />
            <HeaderNotificationsButton />
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
              aria-hidden
            >
              {chromeInitial}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black">
          Appraisal
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Signed in as{" "}
          <span className="font-medium text-black">
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
          className="mt-3 text-sm font-medium text-zinc-600 underline hover:text-black"
        >
          Sign out
        </button>
      </header>

      {notice === "submitted" && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="status"
        >
          Appraisal submitted. <strong>Manager has been notified.</strong>
        </div>
      )}

      {mode === "manager" && notifications.length > 0 && (
        <section
          className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4"
          aria-label="Review notifications"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            Pending your review
          </h2>
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/appraisal/${n.appraisalId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white px-3 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100/80"
                >
                  <span>
                    <strong>{n.employeeName}</strong> submitted an appraisal
                  </span>
                  <span className="text-xs font-medium text-amber-800">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-black">Add appraisal</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Employee and company details are shown on the{" "}
              <strong>Overview</strong> tab after you open a plan. Demo:{" "}
              <strong>one appraisal per employee</strong> — adding another
              replaces the previous row (latest wins).
            </p>
          </div>
          {mode === "employee" && user && (
            <button
              type="button"
              disabled={createBusy}
              className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => createAppraisalForOwner(user.id)}
            >
              {createBusy ? "Creating…" : "+ Add appraisal"}
            </button>
          )}
        </div>
        {mode === "manager" && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="create-for"
                className="mb-1 block text-xs font-medium text-zinc-600"
              >
                Employee
              </label>
              <select
                id="create-for"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black"
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
              className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => createAppraisalForOwner(managerCreateOwnerId)}
            >
              {createBusy ? "Creating…" : "+ Add appraisal"}
            </button>
          </div>
        )}
        {createError && (
          <p className="mt-2 text-sm text-red-600">
            {createError}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {mode === "employee" ? "Your appraisals" : "All appraisals"}
        </h2>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {!list && !error && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
        {list && list.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-600">
              You haven&apos;t created an appraisal yet.
            </p>
            {mode === "employee" && user ? (
              <button
                type="button"
                disabled={createBusy}
                className="mt-4 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => createAppraisalForOwner(user.id)}
              >
                {createBusy ? "Creating…" : "Create your first appraisal"}
              </button>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                Use <strong>+ Add appraisal</strong> above after choosing an
                employee.
              </p>
            )}
          </div>
        )}
        {visibleAppraisals &&
          list &&
          list.length > 0 &&
          visibleAppraisals.length === 0 &&
          mode === "employee" && (
            <p className="text-sm text-zinc-600">
              No appraisal is assigned to your account. Create one above or
              sign in as another demo employee.
            </p>
          )}
        {visibleAppraisals && visibleAppraisals.length > 0 && (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {visibleAppraisals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/appraisal/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-zinc-50"
                >
                  <span className="font-medium text-black">
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
