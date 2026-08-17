/**
 * Whether the demo login shortcuts (Emma/Mark/HR quick-sign-in, and typing
 * one of their emails into the normal sign-in form) should exist at all -
 * not just be hidden. Used both by the login UI (to not render them) and by
 * session-context (so the underlying login functions no-op even if someone
 * tries to trigger them directly, e.g. via devtools) - hiding the buttons
 * alone would leave the door unlocked, just uglier to find.
 *
 * `NEXT_PUBLIC_*` so it's readable client-side (Next.js inlines it at build
 * time); must be set explicitly per environment - there is no site-name or
 * URL sniffing here, because dev and prod are both plain Azure App Service
 * origins that look alike at runtime.
 *
 * - Local `npm run dev` (NODE_ENV=development): always on, no config needed.
 * - Deployed dev App Service: set NEXT_PUBLIC_ENABLE_DEMO_LOGINS=true.
 * - Deployed prod App Service: leave unset - defaults to OFF. This is the
 *   safe default on purpose: forgetting to set a var should never leak demo
 *   accounts into production, only the reverse (dev misconfigured as prod-strict).
 */
export function demoLoginsEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGINS === "true";
}

/**
 * Whether the email/password sign-in form (real ERPNext-verified login,
 * see auth.ts's Credentials provider) should exist at all. Prod's client
 * confirmed prod must allow Microsoft sign-in ONLY - nothing else, not even
 * the real password path. Same shape as demoLoginsEnabled(): safe-by-default
 * (off unless explicitly turned on), checked both in the login UI (don't
 * render the form) and server-side in auth.ts's `authorize()` (refuse the
 * sign-in attempt even if someone posts directly to the credentials
 * callback, bypassing the UI entirely) - not just a hidden button.
 *
 * - Local `npm run dev`: always on, no config needed.
 * - Deployed dev App Service: set NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN=true.
 * - Deployed prod App Service: leave unset - defaults to OFF (Microsoft only).
 */
export function passwordLoginEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN === "true";
}
