"use client";

import { useState, type FormEvent } from "react";
import { DEMO_HR, DEMO_MANAGER, findMockUser } from "@/lib/mock-users";
import { AppLogo } from "@/components/app-logo";
import { useSession } from "@/contexts/session-context";

const EMMA_ID = "emma" as const;

/** Shown in the demo box and accepted on Login (password ignored for demo). */
const DEMO_EMPLOYEE_EMAIL = "emma@aemg.demo";
const DEMO_MANAGER_EMAIL = "mark@aemg.demo";
const DEMO_HR_EMAIL = "hr@aemg.demo";

/**
 * Shared promotional video (same asset on all AIFE portal login pages).
 * Free stock clip — teacher with students in a classroom.
 * Source: https://www.pexels.com/video/7092235/ (Pexels license, no attribution required).
 */
const PROMO_VIDEO_URL =
  "https://videos.pexels.com/video-files/7092235/7092235-hd_1920_1080_30fps.mp4";

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

  function quickLogin(kind: "employee" | "manager" | "hr") {
    if (kind === "employee") loginEmployee(EMMA_ID);
    if (kind === "manager") loginManager();
    if (kind === "hr") loginHr();
  }

  const inputShell =
    "flex items-center gap-2.5 rounded-xl border border-navy-100 bg-navy-50/60 px-3.5 py-3 transition focus-within:border-navy-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-navy-600/15";

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-navy-950 text-white">
      {/* Background: promo video under a navy brand overlay (gradient doubles as
          the fallback while the video loads or if the CDN is unreachable). */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={PROMO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
      <div
        className="aife-hero-gradient absolute inset-0 opacity-[0.72]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:py-12">
        <header className="mb-10 flex items-center justify-between">
          <AppLogo variant="login" href="/" />
          <span className="hidden items-center gap-2 rounded-full border border-gold-400/40 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-gold-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
            Performance Portal
          </span>
        </header>

        <div className="grid flex-1 items-center gap-12 lg:grid-cols-[1.1fr_minmax(380px,440px)]">
          {/* Brand hero */}
          <div className="hidden lg:block">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
              Australia Institute of Future Education
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight">
              Grow with purpose.
              <span className="mt-1 block bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">
                Mid-year check-ins. Annual reviews. One portal.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70">
              Set your KPIs, track progress at the mid-year checkpoint, and
              complete your annual appraisal — with your manager and HR in the
              loop at every step.
            </p>
          </div>

          {/* Sign-in card */}
          <div className="w-full justify-self-center lg:justify-self-end">
            <div className="rounded-3xl bg-white p-8 text-[#0b1930] shadow-2xl ring-1 ring-white/40">
              <h2 className="text-xl font-semibold tracking-tight text-navy-900">
                Sign in
              </h2>
              <p className="mt-1 mb-6 text-sm text-slate-500">
                Welcome back — access your appraisals.
              </p>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className={inputShell}>
                  <MailIcon className="shrink-0 text-navy-600" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@aife.edu.au"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-navy-950 placeholder:text-slate-400 outline-none"
                  />
                </div>

                <div className={inputShell}>
                  <LockIcon className="shrink-0 text-navy-600" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-navy-950 placeholder:text-slate-400 outline-none"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-navy-600 hover:text-navy-800"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-navy-600 hover:text-navy-800"
                    onClick={() => {
                      /* demo: no reset flow */
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {error ? (
                  <p className="text-xs text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-navy-900 to-navy-700 py-3 text-sm font-semibold text-white shadow-lg shadow-navy-900/25 transition hover:from-navy-800 hover:to-navy-600"
                >
                  Sign in
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" aria-hidden />
                <span className="shrink-0 text-xs text-slate-400">
                  demo accounts
                </span>
                <div className="h-px flex-1 bg-slate-200" aria-hidden />
              </div>

              <div className="grid gap-2">
                <DemoAccountRow
                  name={`${emma?.englishName || emma?.employeeName || "Emma Thompson"} · Employee`}
                  email={DEMO_EMPLOYEE_EMAIL}
                  onClick={() => quickLogin("employee")}
                />
                <DemoAccountRow
                  name={`${DEMO_MANAGER.displayName} · Manager`}
                  email={DEMO_MANAGER_EMAIL}
                  onClick={() => quickLogin("manager")}
                />
                <DemoAccountRow
                  name={`${DEMO_HR.displayName} · HR / Super Admin`}
                  email={DEMO_HR_EMAIL}
                  onClick={() => quickLogin("hr")}
                />
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                Password is not checked in this demo — click a role to sign in.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
          <span>© {new Date().getFullYear()} AIFE — AEMG Education Group</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-6 rounded-full bg-gold-500" aria-hidden />
            Blue &amp; Gold — one brand across every portal
          </span>
        </footer>
      </div>
    </div>
  );
}

function DemoAccountRow({
  name,
  email,
  onClick,
}: {
  name: string;
  email: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:border-gold-500/60 hover:bg-gold-50"
    >
      <span>
        <span className="block text-sm font-medium text-navy-900">{name}</span>
        <span className="block font-mono text-[11px] text-slate-500">
          {email}
        </span>
      </span>
      <span className="text-xs font-semibold text-navy-600 opacity-0 transition group-hover:opacity-100">
        Sign in →
      </span>
    </button>
  );
}
