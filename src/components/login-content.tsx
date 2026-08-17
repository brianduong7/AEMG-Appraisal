"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { DEMO_HR, DEMO_MANAGER, findMockUser } from "@/lib/mock-users";
import { AppLogo } from "@/components/app-logo";
import { useSession } from "@/contexts/session-context";
import { demoLoginsEnabled, passwordLoginEnabled } from "@/lib/env";

const EMMA_ID = "emma" as const;

/**
 * Why sign-in failed, in words a person can act on. `no-employee-record` is
 * ours (see auth.ts); the rest are Auth.js's own error codes. Anything
 * unrecognised falls back to a generic line rather than showing a raw code.
 */
function ssoErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "no-employee-record") {
    return "Your Microsoft sign-in worked, but there is no employee record matching that address in the HR system. Contact HR to have your record set up or your work email corrected.";
  }
  if (code === "AccessDenied") {
    return "Access denied. Your account is not permitted to sign in to this portal.";
  }
  if (code === "CredentialsSignin") {
    return "Incorrect email or password.";
  }
  return "Sign-in could not be completed. Please try again, or contact IT if it keeps happening.";
}

/** Shown in the demo box and accepted on Login (password ignored for demo). */
const DEMO_EMPLOYEE_EMAIL = "emma@aemg.demo";
const DEMO_MANAGER_EMAIL = "mark@aemg.demo";
const DEMO_HR_EMAIL = "hr@aemg.demo";

/**
 * AIFE's own event highlight reel, replacing the earlier Pexels stock clip.
 * Served locally from /public rather than a third-party CDN. Re-encoded
 * from the original 1080p/41MB source down to 720p/~11MB with ffmpeg -
 * audio stripped (plays muted anyway) and bitrate reduced - the original
 * was too heavy to autoplay on every login page visit.
 */
const PROMO_VIDEO_URL = "/videos/aife-event-highlight.mp4";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Captured into state on first render, not read live from the URL - the
   * `?error=` query param otherwise sticks around forever (a plain refresh
   * reloads the exact same URL, so the message never went away; someone
   * had to manually edit the address bar to clear it). The effect below
   * strips the param from the URL right after, so the message still shows
   * once here but a refresh lands on a clean sign-in screen.
   */
  const [ssoError] = useState(() =>
    ssoErrorMessage(searchParams.get("error"))
  );

  useEffect(() => {
    if (!searchParams.get("error")) return;
    const params = new URLSearchParams(searchParams);
    params.delete("error");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showDemo = demoLoginsEnabled();
  const showPasswordForm = passwordLoginEnabled();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!showPasswordForm) return; // form isn't rendered when this is false; defensive only

    if (showDemo) {
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
    }

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    // Real login: verified against ERPNext's own password check, then the
    // same employee-identity resolution Microsoft sign-in uses - see
    // auth.ts's Credentials provider. Default (redirecting) signIn(), same
    // pattern as the Microsoft button below: on failure it lands back here
    // with ?error=CredentialsSignin, picked up by ssoError above.
    setSubmitting(true);
    try {
      await signIn("credentials", { email: email.trim(), password });
    } finally {
      setSubmitting(false);
    }
  }

  function quickLogin(kind: "employee" | "manager" | "hr") {
    if (kind === "employee") loginEmployee(EMMA_ID);
    if (kind === "manager") loginManager();
    if (kind === "hr") loginHr();
  }

  const inputShell =
    "flex items-center gap-2.5 rounded-xl border border-navy-100 bg-navy-50/60 px-3.5 py-3 transition focus-within:border-navy-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-navy-600/15";

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-navy-900 text-white">
      {/* Background: promo video under a solid logo-blue overlay
          (also the fallback while the video loads or if the CDN is unreachable). */}
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
              <span className="mt-1 block text-gold-300">
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
            <div className="rounded-3xl bg-white p-8 text-navy-900 shadow-2xl ring-1 ring-white/40">
              <h2 className="text-xl font-semibold tracking-tight text-navy-900">
                Sign in
              </h2>
              <p className="mt-1 mb-6 text-sm text-slate-500">
                Welcome back — access your appraisals.
              </p>

              {showPasswordForm && (
                <>
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
                          /* Real password reset would go through ERPNext's own
                             flow - not built yet, deliberately out of scope
                             here. */
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
                      disabled={submitting}
                      className="w-full rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white shadow-lg shadow-navy-900/25 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Signing in…" : "Sign in"}
                    </button>
                  </form>

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" aria-hidden />
                    <span className="shrink-0 text-xs text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" aria-hidden />
                  </div>
                </>
              )}

              {/*
                Uses Auth.js's signIn() rather than posting to the sign-in
                URL directly: that endpoint requires a CSRF token in the body
                and rejects a bare form post with MissingCSRF. signIn()
                fetches and includes it.
              */}
              <button
                type="button"
                onClick={() => void signIn("microsoft-entra-id")}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 23 23" aria-hidden>
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                Sign in with Microsoft
              </button>

              {ssoError && (
                <p
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
                  role="alert"
                >
                  {ssoError}
                </p>
              )}

              {showDemo && (
                <>
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
                </>
              )}
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
