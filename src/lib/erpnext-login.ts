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
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return body?.message === "Logged In";
  } catch (e) {
    console.error("[auth] ERPNext password verify failed:", e);
    return false;
  }
}
