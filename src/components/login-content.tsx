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
        <h1 className="text-2xl font-semibold tracking-tight text-black">
          AEMG Appraisal
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Employees sign in to complete or view <strong>only</strong> their own
          plan. Managers use a separate entry to review all submissions.
        </p>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-black">
          Employee sign-in
        </h2>
        <label
          htmlFor="user"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Select employee
        </label>
        <select
          id="user"
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {MOCK_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.employeeName} — {u.position}
            </option>
          ))}
        </select>

        <div className="mb-4 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-3 text-xs text-zinc-600">
          {MOCK_USERS.filter((u) => u.id === selectedId).map((u) => (
            <dl key={u.id} className="grid gap-1">
              <div>
                <dt className="inline font-medium text-zinc-700">
                  Department:{" "}
                </dt>
                <dd className="inline">{u.department}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700">
                  Manager:{" "}
                </dt>
                <dd className="inline">{u.managerName}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700">
                  Entity:{" "}
                </dt>
                <dd className="inline">{u.entity}</dd>
              </div>
            </dl>
          ))}
        </div>

        <button
          type="button"
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          onClick={() => selectedId && loginEmployee(selectedId)}
        >
          Sign in as employee
        </button>

        <div className="my-6 border-t border-zinc-200" />

        <h2 className="mb-2 text-sm font-semibold text-black">
          Manager sign-in (Mark)
        </h2>
        <p className="mb-3 text-xs text-zinc-600">
          When Emma (or others who report to Mark) submits an appraisal, you
          see an in-app notification here and can complete the manager review.
          You can also create appraisal drafts for any demo employee.
        </p>
        <button
          type="button"
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-50"
          onClick={() => loginManager()}
        >
          Sign in as Mark (manager)
        </button>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Demo only — no password.
        </p>
      </div>
    </div>
  );
}
