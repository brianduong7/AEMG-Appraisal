"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DEMO_HR, DEMO_MANAGER, findMockUser } from "@/lib/mock-users";
import { useSession } from "@/contexts/session-context";

const EMMA_ID = "emma" as const;

/** Shown in the grey box and accepted on Login (password ignored for demo). */
const DEMO_EMPLOYEE_EMAIL = "emma@aemg.demo";
const DEMO_MANAGER_EMAIL = "mark@aemg.demo";
const DEMO_HR_EMAIL = "hr@aemg.demo";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function LoginContent() {
  const { loginEmployee, loginManager, loginHr } = useSession();
  const emma = findMockUser(EMMA_ID);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (normalized === DEMO_EMPLOYEE_EMAIL.toLowerCase()) {
      loginEmployee(EMMA_ID);
      return;
    }
    if (normalized === DEMO_MANAGER_EMAIL.toLowerCase()) {
      loginManager();
      return;
    }
    if (normalized === DEMO_HR_EMAIL.toLowerCase()) {
      loginHr();
      return;
    }
    setError(
      "That email is not a demo account. Use the addresses in the box below."
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F3F4F6] text-black">
      <header className="border-b border-zinc-200/80 bg-white px-4 py-2.5">
        <Link
          href="/"
          className="text-sm font-normal text-zinc-700 hover:text-zinc-900"
        >
          Home
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-zinc-900 text-sm font-semibold text-white"
            aria-hidden
          >
            A
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Login to AEMG Appraisal
          </h1>
        </div>

        <div className="w-full max-w-[400px] rounded-xl bg-white p-8 shadow-sm">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex items-center gap-2.5 rounded-[10px] bg-[#F0F0F0] px-3 py-2.5">
              <MailIcon className="shrink-0 text-zinc-500" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2.5 rounded-[10px] bg-[#F0F0F0] px-3 py-2.5">
              <LockIcon className="shrink-0 text-zinc-500" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-500 outline-none"
              />
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-zinc-700"
                onClick={() => {
                  /* demo: no reset flow */
                }}
              >
                Forgot Password?
              </button>
            </div>

            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-[10px] bg-[#1A1A1A] py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Login
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" aria-hidden />
            <span className="shrink-0 text-xs text-zinc-500">or</span>
            <div className="h-px flex-1 bg-zinc-200" aria-hidden />
          </div>

          <button
            type="button"
            className="w-full cursor-default rounded-[10px] bg-[#F0F0F0] py-2.5 text-sm font-medium text-zinc-800"
            title="Not available in this demo"
          >
            Login with Email Link
          </button>
        </div>

        <div className="mt-4 w-full max-w-[400px] rounded-[10px] bg-[#F0F0F0] px-4 py-4 text-xs text-zinc-700">
          <p className="mb-3 font-semibold text-zinc-900">Demo login</p>
          <ul className="space-y-3">
            <li>
              <span className="font-medium text-zinc-900">
                {emma?.employeeName ?? "Emma"} (employee)
              </span>
              <div className="mt-1 font-mono text-[11px] text-zinc-600">
                <div>Email: {DEMO_EMPLOYEE_EMAIL}</div>
                <div>Password: any (not checked)</div>
              </div>
            </li>
            <li className="border-t border-zinc-300/80 pt-3">
              <span className="font-medium text-zinc-900">
                {DEMO_MANAGER.displayName} (manager)
              </span>
              <div className="mt-1 font-mono text-[11px] text-zinc-600">
                <div>Email: {DEMO_MANAGER_EMAIL}</div>
                <div>Password: any (not checked)</div>
              </div>
            </li>
            <li className="border-t border-zinc-300/80 pt-3">
              <span className="font-medium text-zinc-900">
                {DEMO_HR.displayName} (HR)
              </span>
              <div className="mt-1 font-mono text-[11px] text-zinc-600">
                <div>Email: {DEMO_HR_EMAIL}</div>
                <div>Password: any (not checked)</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
