import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { resolveErpnextIdentity, type ErpnextIdentity } from "@/lib/erpnext-identity";

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
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  // The login screen is the app root, not a dedicated /login route.
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ profile }) {
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

    async jwt({ token, profile }) {
      // `profile` is only present on the initial sign-in; on later calls the
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
