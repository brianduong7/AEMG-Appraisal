import { NextResponse } from "next/server";
import { readAppraisals } from "@/lib/appraisal-store";
import {
  getAppraisal as getFromErpnext,
  shadowDiffAppraisal,
  type Actor,
} from "@/lib/appraisal-repo";
import { erpnextEmployeeIdForOwner } from "@/lib/erpnext";
import { erpnextApiCall } from "@/lib/erpnext";

/**
 * Shadow-read verification for the ERPNext migration. NOT a product route.
 *
 * Reads every appraisal from the local store (still authoritative), fetches
 * the same record from ERPNext through the new read API, maps it, and diffs
 * the two. An empty `diffs` for every record is the evidence that the mapper
 * and the backend agree well enough to flip reads over.
 *
 * This exists because the alternative - switching reads and finding out from
 * users - hides mapper bugs as silent corruption, at the exact moment the
 * local copy stops existing and there is nothing left to compare against.
 *
 * Dev-only: refuses outright in production, where it would be an org-wide
 * data-exposure endpoint with no auth.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const local = await readAppraisals();
  // Service-account read with no on-behalf-of: the add-on resolves that to
  // the integration user's own HR rights, which is what a whole-store sweep
  // needs. Scope enforcement is exercised separately.
  const actor: Actor = { employee: "", isHr: true, isManager: false };

  const results: unknown[] = [];
  for (const a of local) {
    const employee = erpnextEmployeeIdForOwner(a.ownerUserId);
    if (!employee) {
      results.push({ id: a.id, owner: a.ownerUserId, skipped: "no ERPNext employee" });
      continue;
    }

    // The local id is a UUID; ERPNext's is HR-APR-*. Resolve by employee +
    // cycle, the same way the mirror functions do, since nothing local
    // persists the ERPNext name.
    const found = await erpnextApiCall<{ name: string }[]>(
      "appraisal_read.list_appraisals",
      { scope: "org", cycle_year: a.cycleYear, include_children: 0 },
      undefined,
      undefined
    );
    if (!found.ok) {
      results.push({ id: a.id, owner: a.ownerUserId, error: found.error });
      continue;
    }
    const match = (found.data as unknown as { name: string; employee: string }[]).find(
      (r) => r.employee === employee
    );
    if (!match) {
      results.push({
        id: a.id,
        owner: a.ownerUserId,
        employee,
        missing: "no ERPNext appraisal for this employee+cycle",
      });
      continue;
    }

    try {
      const remote = await getFromErpnext(actor, match.name);
      if (!remote) {
        results.push({ id: a.id, employee, missing: match.name });
        continue;
      }
      const diffs = shadowDiffAppraisal(a, remote);
      results.push({
        id: a.id,
        erpnext: match.name,
        employee,
        name: a.employeeName,
        clean: diffs.length === 0,
        diffs,
      });
    } catch (e) {
      results.push({
        id: a.id,
        employee,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const compared = results.filter(
    (r) => typeof (r as { clean?: boolean }).clean === "boolean"
  );
  const clean = compared.filter((r) => (r as { clean: boolean }).clean);
  return NextResponse.json({
    total_local: local.length,
    compared: compared.length,
    clean: clean.length,
    with_diffs: compared.length - clean.length,
    results,
  });
}
