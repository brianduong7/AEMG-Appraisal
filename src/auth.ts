import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { resolveErpnextIdentity, type ErpnextIdentity } from "@/lib/erpnext-identity";
import { verifyErpnextPassword } from "@/lib/erpnext-login";
import { passwordLoginEnabled } from "@/lib/env";

/**
 * Microsoft Entra SSO. Two gates, in order:
 *
 *   1. Entra proves the person is who they claim (and, because the app
 *      registration is single-tenant, that they're in the AEMG directory).
 *   2. ERPNext decides whether that person is an employee we run appraisals
 *      for, and what role they hold.
 *
 * Passing (1) without (2) is refused - a valid AEMG mailbox is not the same
 * as being under appraisal. See api/identity.py for why.
 *
 * Role is resolved once at sign-in and carried in the JWT rather than being
 * re-read per request. That keeps normal page loads off ERPNext, at the cost
 * of a stale role until the token refreshes: if someone is promoted to
 * manager mid-session they see it after signing out and back in. Acceptable
 * for a change that happens rarely and is never a security boundary on its
 * own - every write is re-checked server-side by the add-on.
 *
 * This runs ALONGSIDE the existing demo logins, which are untouched. The
 * demo path is localStorage-only with no server session; this one is a real
 * signed cookie. `session-context` reconciles the two.
 */

declare module "next-auth" {
  interface Session {
    identity?: ErpnextIdentity;
  }
  interface User {
    identity?: ErpnextIdentity;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID,
    /**
     * Email/password login for prod, verified against ERPNext's own
     * `/api/method/login` (see erpnext-login.ts) - not a separate password
     * store. Same authorization gate as the Microsoft path below: a
     * correct ERPNext password only proves identity, `resolveErpnextIdentity`
     * still decides whether that person is an employee we run appraisals
     * for. `authorize` returning null is Auth.js's own signal for "wrong
     * credentials" - surfaces as a CredentialsSignin error on the login page.
     */
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        // Server-side gate, not just a hidden UI button - refuses even a
        // request posted directly to the credentials callback, bypassing
        // the login form entirely. Prod's client confirmed: Microsoft only.
        if (!passwordLoginEnabled()) return null;

        const email =
          typeof creds?.email === "string" ? creds.email.trim() : "";
        const password =
          typeof creds?.password === "string" ? creds.password : "";
        if (!email || !password) return null;

        const passwordOk = await verifyErpnextPassword(email, password);
        if (!passwordOk) return null;

        const identity = await resolveErpnextIdentity(email);
        if (!identity) return null;

        return { id: identity.employee, email, identity };
      },
    }),
  ],
  // The login screen is the app root, not a dedicated /login route.
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ profile, account }) {
      // Credentials sign-ins are already fully verified inside authorize()
      // above (both the password AND the employee-identity check) - nothing
      // further to check here.
      if (account?.provider === "credentials") return true;

      // Entra populates `email` inconsistently depending on how the account
      // was created; `preferred_username` and `upn` are the reliable
      // fallbacks, and are what an AEMG address actually arrives in.
      const p = profile as
        | { email?: string; preferred_username?: string; upn?: string }
        | undefined;
      const email = p?.email ?? p?.preferred_username ?? p?.upn;

      const identity = await resolveErpnextIdentity(email);
      if (!identity) {
        // Returning a URL rather than false so the login screen can explain
        // what happened. Deliberately does not echo the address back into the
        // query string - it would end up in browser history and server logs
        // for what is, at that point, an unauthenticated stranger.
        return "/?error=no-employee-record";
      }
      return true;
    },

    async jwt({ token, profile, user }) {
      // `profile` is only present on the initial OAuth (Microsoft) sign-in;
      // `user` is only present on the initial Credentials sign-in (it's
      // exactly what `authorize()` returned above). On later calls the
      // token is just being refreshed and already carries the identity.
      if (profile) {
        const p = profile as {
          email?: string;
          preferred_username?: string;
          upn?: string;
        };
        const email = p.email ?? p.preferred_username ?? p.upn;
        const identity = await resolveErpnextIdentity(email);
        if (identity) {
          token.identity = identity;
          token.email = email;
        }
      } else if (user?.identity) {
        token.identity = user.identity;
        token.email = user.email ?? undefined;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.identity) {
        session.identity = token.identity as ErpnextIdentity;
      }
      return session;
    },
  },
});
