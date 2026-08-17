/**
 * Verifies an email/password pair against ERPNext's own login endpoint.
 * This is a pure credential check - we discard the session ERPNext hands
 * back (`sid` cookie) rather than keeping it, because every other part of
 * this app already has its own way of acting against ERPNext (the shared
 * integration account + on-behalf-of, or a demo user's own API key). We
 * don't need a second, parallel per-user ERPNext session just to answer
 * "is this the right password" - only the yes/no matters here.
 */
export async function verifyErpnextPassword(
  email: string,
  password: string
): Promise<boolean> {
  if (!email || !password) return false;
  if (!process.env.ERPNEXT_URL) return false;

  try {
    const res = await fetch(`${process.env.ERPNEXT_URL}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ usr: email, pwd: password }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      exception?: string;
    };
    // Frappe's success message varies with the account's role/desk access -
    // "Logged In" for a full desk user, "No App" for one with no assigned
    // workspace (e.g. an Employee with no HR/Manager roles). Both are a
    // genuinely correct password; only an `exception` in the body (wrong
    // password -> AuthenticationError, HTTP 401 anyway) means failure.
    // Caught live: a real test account with the right password was refused
    // sign-in because it matched only the "Logged In" string.
    return !body.exception;
  } catch (e) {
    console.error("[auth] ERPNext password verify failed:", e);
    return false;
  }
}
