/**
 * Appraisal reads backed by ERPNext.
 *
 * The read half of making ERPNext the source of truth. Deliberately shipped
 * before the write half and before anything switches over to it, so the
 * shapes can be proven against real data (see `shadowDiffAppraisal`) while
 * the local store is still authoritative and users are unaffected.
 *
 * WHY AN `actor` ON EVERY CALL
 *
 * The old store took none, because it read a local file - so authorization
 * lived in the UI, and `GET /api/appraisals` handed every appraisal in the
 * org to every caller and let the client filter. That is survivable with
 * demo data and a genuine leak once ERPNext is authoritative. Requiring the
 * caller to say who is asking is the forcing function that makes the API
 * routes stop trusting the client: scope is then enforced server-side in
 * ERPNext, against the acting identity, not here.
 */

import { erpnextApiCall } from "./erpnext";
import {
  appraisalFromErpnext,
  type ErpAppraisal,
} from "./erpnext-appraisal-mapper";
import type { Appraisal } from "./types";

/** Who is asking. `employee` is the ERPNext Employee id (HR-EMP-000xx). */
export type Actor = {
  employee: string;
  isHr: boolean;
  isManager: boolean;
};

export type AppraisalScope = "self" | "team" | "org";

/**
 * Errors are thrown, not swallowed.
 *
 * The mirror functions in erpnext.ts return null on failure by design - a
 * failed mirror was cosmetic because the local store had already succeeded.
 * Once ERPNext IS the store, a swallowed error is a silently lost read or
 * write, so these surface instead. This is the single most important
 * behavioural difference between this module and the mirror it replaces.
 */
export class ErpnextUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErpnextUnavailableError";
  }
}

/** ERPNext refused this on authorization grounds - not an outage. */
export class ErpnextForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErpnextForbiddenError";
  }
}

/** The record does not exist - an expected answer, not a failure. */
export class ErpnextNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErpnextNotFoundError";
  }
}

async function call<T>(
  method: string,
  payload: Record<string, unknown>,
  actor: Actor | null
): Promise<T> {
  const result = await erpnextApiCall<T>(
    method,
    payload,
    undefined,
    actor?.employee
  );
  if (!result.ok) {
    // A refusal and an outage look the same to a caller that only has a
    // string, and they are not the same thing at all: one is "you may not
    // see this", the other is "we could not ask". Collapsing them would
    // show an alarming infrastructure error for a routine permission check.
    if (result.kind === "PermissionError") {
      throw new ErpnextForbiddenError(result.error);
    }
    if (result.kind === "DoesNotExistError") {
      throw new ErpnextNotFoundError(result.error);
    }
    throw new ErpnextUnavailableError(result.error);
  }
  return result.data;
}

/**
 * Appraisals visible to `actor` at `scope`.
 *
 * The scope is validated server-side against the acting identity - asking
 * for one you do not hold is a PermissionError, not a quiet downgrade to a
 * narrower list. A caller that believes it is rendering an HR view must not
 * be handed a personal view and present it as complete.
 */
export async function listAppraisals(
  actor: Actor,
  scope: AppraisalScope,
  opts: { cycleYear?: number; includeChildren?: boolean } = {}
): Promise<Appraisal[]> {
  const rows = await call<ErpAppraisal[]>(
    "appraisal_read.list_appraisals",
    {
      scope,
      cycle_year: opts.cycleYear ?? null,
      include_children: opts.includeChildren ? 1 : 0,
    },
    actor
  );
  return (rows ?? []).map(appraisalFromErpnext);
}

export async function getAppraisal(
  actor: Actor,
  id: string
): Promise<Appraisal | null> {
  try {
    const doc = await call<ErpAppraisal>(
      "appraisal_read.get_appraisal",
      { appraisal: id },
      actor
    );
    return doc ? appraisalFromErpnext(doc) : null;
  } catch (e) {
    // A missing appraisal is an expected answer ("this id is not a thing"),
    // not an outage - keep those distinguishable so a 404 never reads as
    // "ERPNext is down" and vice versa.
    if (e instanceof ErpnextNotFoundError) return null;
    if (e instanceof ErpnextUnavailableError && /not found/i.test(e.message)) {
      return null;
    }
    throw e;
  }
}

/**
 * One active (non-draft) appraisal per employee per cycle.
 *
 * Drafts stay unlimited; this only gates the submit, matching the local
 * store's own rule. Enforced server-side now so two browser tabs cannot race
 * past a client-side check.
 */
export async function hasActiveAppraisal(
  actor: Actor,
  opts: { employee?: string; cycleYear?: number; excludeId?: string } = {}
): Promise<boolean> {
  return call<boolean>(
    "appraisal_read.has_active_appraisal",
    {
      employee: opts.employee ?? actor.employee,
      cycle_year: opts.cycleYear ?? null,
      exclude: opts.excludeId ?? null,
    },
    actor
  );
}

/**
 * Compare what ERPNext would return against the local store's record.
 *
 * Used by the shadow-read verification: while the local store is still
 * authoritative, fetch the same appraisal from ERPNext, map it, and diff.
 * Any non-empty result is a mapper bug or a field ERPNext is not yet
 * carrying - exactly the class of problem that would otherwise only surface
 * as silent corruption after cutover, when the local copy is gone and there
 * is nothing left to compare against.
 *
 * Compares only fields ERPNext is expected to own. Returns a list of
 * human-readable differences, empty when the two agree.
 */
export function shadowDiffAppraisal(local: Appraisal, remote: Appraisal): string[] {
  const diffs: string[] = [];
  const scalar: (keyof Appraisal)[] = [
    "cycleYear",
    "ownerUserId",
    "reviewingManagerId",
    "employeeName",
    "position",
    "department",
    "mLevel",
    "managerName",
    "entity",
    "status",
    "midYearStatus",
    "midYearManagerComments",
    "employeeComments",
    "managerComments",
    "managerOverallOverride",
  ];
  for (const key of scalar) {
    const a = local[key] ?? null;
    const b = remote[key] ?? null;
    if (String(a) !== String(b)) {
      diffs.push(`${String(key)}: local=${JSON.stringify(a)} erpnext=${JSON.stringify(b)}`);
    }
  }

  if (local.kpis.length !== remote.kpis.length) {
    diffs.push(`kpis.length: local=${local.kpis.length} erpnext=${remote.kpis.length}`);
  } else {
    local.kpis.forEach((k, i) => {
      const r = remote.kpis[i]!;
      const fields: (keyof typeof k)[] = [
        "goalsAndKpis",
        "weightPercent",
        "dueDate",
        "selfRating",
        "managerRating",
        "managerComments",
        "midYearRating",
        "midYearComment",
      ];
      for (const f of fields) {
        if (String(k[f] ?? null) !== String(r[f] ?? null)) {
          diffs.push(
            `kpis[${i}].${String(f)}: local=${JSON.stringify(k[f])} erpnext=${JSON.stringify(r[f])}`
          );
        }
      }
    });
  }

  local.capabilities.forEach((c, i) => {
    const r = remote.capabilities[i];
    if (!r) {
      diffs.push(`capabilities[${i}]: missing in erpnext`);
      return;
    }
    if (c.id !== r.id) {
      diffs.push(`capabilities[${i}].id: local=${c.id} erpnext=${r.id}`);
    }
    for (const f of ["selfRating", "managerRating", "managerComments"] as const) {
      if (String(c[f] ?? null) !== String(r[f] ?? null)) {
        diffs.push(
          `capabilities[${i}].${f}: local=${JSON.stringify(c[f])} erpnext=${JSON.stringify(r[f])}`
        );
      }
    }
  });

  return diffs;
}
