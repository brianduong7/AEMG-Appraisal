"use client";

import { useState } from "react";
import { MOCK_USERS } from "@/lib/mock-users";
import { useSession } from "@/contexts/session-context";

export function LoginContent() {
  const { loginEmployee, loginManager } = useSession();
  const [selectedId, setSelectedId] = useState(MOCK_USERS[0]?.id ?? "");

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-4 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AEMG Appraisal
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Employees sign in to complete or view <strong>only</strong> their own
          plan. Managers use a separate entry to review all submissions.
        </p>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Employee sign-in
        </h2>
        <label
          htmlFor="user"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Select employee
        </label>
        <select
          id="user"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {MOCK_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.employeeName} — {u.position}
            </option>
          ))}
        </select>

        <div className="mb-4 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
          {MOCK_USERS.filter((u) => u.id === selectedId).map((u) => (
            <dl key={u.id} className="grid gap-1">
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">
                  Department:{" "}
                </dt>
                <dd className="inline">{u.department}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">
                  Manager:{" "}
                </dt>
                <dd className="inline">{u.managerName}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">
                  Entity:{" "}
                </dt>
                <dd className="inline">{u.entity}</dd>
              </div>
            </dl>
          ))}
        </div>

        <button
          type="button"
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          onClick={() => selectedId && loginEmployee(selectedId)}
        >
          Sign in as employee
        </button>

        <div className="my-6 border-t border-zinc-200 dark:border-zinc-700" />

        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Manager sign-in
        </h2>
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
          Review any employee&apos;s appraisal after they submit. Read/write
          manager sections only.
        </p>
        <button
          type="button"
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => loginManager()}
        >
          Sign in as manager
        </button>

        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Demo only — no password.
        </p>
      </div>
    </div>
  );
}
