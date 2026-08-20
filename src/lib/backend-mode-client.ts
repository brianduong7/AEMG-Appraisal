/**
 * Whether the browser should treat lists as already scoped by the server.
 *
 * Mirrors APPRAISAL_BACKEND, which is server-only. The client needs to know
 * because its own filtering is written against demo roster ids and would
 * silently empty a manager's team once records carry real ERPNext ids.
 *
 * Read at module scope deliberately: NEXT_PUBLIC_* values are inlined at
 * build time, so this cannot drift at runtime the way a fetched flag could.
 */
export function serverScopesAppraisals(): boolean {
  const raw = process.env.NEXT_PUBLIC_APPRAISAL_BACKEND ?? "";
  return raw === "erpnext" || raw === "erpnext-read";
}
