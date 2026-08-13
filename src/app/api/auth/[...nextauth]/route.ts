import { handlers } from "@/auth";

/**
 * Auth.js route handlers. The callback path registered in Entra is
 * /api/auth/callback/microsoft-entra-id, which this catch-all serves - if
 * this file moves, the app registration's redirect URIs must move with it.
 */
export const { GET, POST } = handlers;
