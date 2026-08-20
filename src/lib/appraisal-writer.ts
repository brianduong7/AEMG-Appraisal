/**
 * Appraisal writes, against ERPNext.
 *
 * The counterpart to appraisal-repo.ts, and the half that makes ERPNext the
 * store rather than a copy of it.
 *
 * WHY THIS IS NOT A PORT OF updateAppraisal()
 *
 * The local store's `updateAppraisal(id, updater)` takes a closure that
 * rewrites the whole document and writes it back. That shape cannot be
 * carried over honestly: against ERPNext it is a read-modify-write race
 * over a phase-gated state machine, and the only way to make it work would
 * be to funnel every action through `hr_override_appraisal` - the HR escape
 * hatch that skips all validation and full-replaces the goals table. An
 * employee saving a draft would then be one malformed payload away from
 * silently deleting their own KPIs. So each action calls the endpoint that
 * was built for it, and the phase gates stay real.
 *
 * WHY EVERY FUNCTION RE-READS AT THE END
 *
 * The write endpoints return acknowledgements ({"goals": 3}), not
 * documents. The client needs the full updated record, and deriving it
 * locally would mean maintaining a second model of ERPNext's state machine
 * in TypeScript - which is exactly the drift this migration exists to end.
 * One extra read is worth never having to keep two copies of that logic in
 * step.
 */

import { erpnextApiCall } from "./erpnext";
import {
  getAppraisal,
  ErpnextConflictError,
  ErpnextForbiddenError,
  ErpnextNotFoundError,
  ErpnextUnavailableError,
  type Actor,
} from "./appraisal-repo";
import {
  kpisToErpGoalsFull,
  capabilityManagerRatingsToErp,
  capabilitySelfRatingsToErp,
  kpiManagerRatingsToErp,
  kpiMidYearCommentsToErp,
  kpiMidYearToErp,
  kpiSelfRatingsToErp,
  kpisToErpGoals,
} from "./erpnext-appraisal-mapper";
import type { Appraisal, CapabilityRow, KpiRow } from "./types";

/** One whitelisted call, as the acting employee. Throws on failure. */
async function call(
  actor: Actor,
  method: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await erpnextApiCall(
    `appraisal.${method}`,
    payload,
    undefined,
    actor.employee
  );
  if (res.ok) return;
  // Same classification as the read path: a refused write and an unreachable
  // ERPNext are different things to tell a user, and neither should be
  // silently swallowed the way the old best-effort mirror did.
  if (res.kind === "PermissionError") throw new ErpnextForbiddenError(res.error);
  if (res.kind === "DoesNotExistError") throw new ErpnextNotFoundError(res.error);
  if (res.kind === "ValidationError") throw new ErpnextConflictError(res.error);
  throw new ErpnextUnavailableError(res.error);
}

async function reread(actor: Actor, appraisal: string): Promise<Appraisal> {
  const next = await getAppraisal(actor, appraisal);
  if (!next) throw new ErpnextNotFoundError("Appraisal not found after write.");
  return next;
}

export type WriteAction =
  | "employee_save"
  | "employee_submit"
  | "manager_kpi_approve"
  | "employee_midyear_save"
  | "employee_midyear_submit"
  | "manager_midyear_save"
  | "manager_midyear_submit"
  | "employee_annual_save"
  | "employee_annual_submit"
  | "manager_submit"
  | "manager_complete"
  | "hr_update";

export type WritePayload = {
  kpis?: KpiRow[];
  /** Did the caller actually send KPI rows? See the hr_update branch. */
  kpisProvided?: boolean;
  capabilities?: CapabilityRow[];
  employeeComments?: string;
  managerComments?: string;
  midYearManagerComments?: string;
  managerOverallOverride?: number | null;
  status?: string;
  midYearStatus?: string;
};

/**
 * Apply one lifecycle action and return the resulting appraisal.
 *
 * Ordering within a compound action matters and mirrors the app's own
 * semantics: content is written first, then the transition that locks it.
 * If the transition fails the content is still saved, which is the same
 * outcome as the "save" variant of that action - a recoverable state the
 * user can retry from, rather than losing what they typed.
 */
export async function applyErpnextAction(
  actor: Actor,
  appraisal: string,
  action: WriteAction,
  payload: WritePayload
): Promise<Appraisal> {
  const kpis = payload.kpis ?? [];
  const capabilities = payload.capabilities ?? [];

  switch (action) {
    case "employee_save":
    case "employee_submit": {
      await call(actor, "update_kpis", {
        appraisal,
        goals: kpisToErpGoals(kpis),
      });
      if (action === "employee_submit") {
        await call(actor, "submit_kpis", { appraisal });
      }
      break;
    }

    case "manager_kpi_approve":
      await call(actor, "approve_kpis", { appraisal });
      break;

    case "employee_midyear_save":
    case "employee_midyear_submit": {
      await call(actor, "update_mid_year_ratings", {
        appraisal,
        ratings: kpiMidYearToErp(kpis),
      });
      if (action === "employee_midyear_submit") {
        await call(actor, "submit_mid_year_employee", { appraisal });
      }
      break;
    }

    case "manager_midyear_save":
      // Manager mid-year comments used to have no save-only endpoint at all,
      // so a draft save reached ERPNext only if the manager also finalized.
      await call(actor, "update_mid_year_manager", {
        appraisal,
        manager_comments: payload.midYearManagerComments ?? "",
        goal_comments: kpiMidYearCommentsToErp(kpis),
      });
      break;

    case "manager_midyear_submit":
      await call(actor, "complete_mid_year", {
        appraisal,
        manager_comments: payload.midYearManagerComments ?? "",
        goal_comments: kpiMidYearCommentsToErp(kpis),
      });
      break;

    case "employee_annual_save":
    case "employee_annual_submit": {
      await call(actor, "update_annual_self_ratings", {
        appraisal,
        ratings: kpiSelfRatingsToErp(kpis),
      });
      await call(actor, "update_capability_self_ratings", {
        appraisal,
        ratings: capabilitySelfRatingsToErp(capabilities),
      });
      if (action === "employee_annual_submit") {
        await call(actor, "submit_annual_self", {
          appraisal,
          employee_comments: payload.employeeComments ?? "",
        });
      }
      break;
    }

    case "manager_submit": {
      await call(actor, "update_annual_manager_ratings", {
        appraisal,
        ratings: kpiManagerRatingsToErp(kpis),
      });
      await call(actor, "update_capability_manager_ratings", {
        appraisal,
        ratings: capabilityManagerRatingsToErp(capabilities),
      });
      await call(actor, "submit_annual_manager", {
        appraisal,
        manager_comments: payload.managerComments ?? "",
      });
      break;
    }

    case "manager_complete":
      await call(actor, "complete_appraisal", {
        appraisal,
        manager_overall_override: payload.managerOverallOverride ?? null,
      });
      break;

    case "hr_update": {
      // The one action that legitimately writes everything at once - it is
      // the admin override, and its whole purpose is to bypass the phase
      // gates. Deliberately the ONLY caller of hr_override_appraisal.
      const data: Record<string, unknown> = {};
      // Full replace: send EVERY field, or the ones omitted are erased. And
      // only send goals at all when the caller actually supplied KPI
      // content - an HR save that only touches a comment must not rewrite
      // the KPI table as a side effect.
      if (payload.kpisProvided) data.goals = kpisToErpGoalsFull(kpis);
      if (payload.employeeComments !== undefined) {
        data.aemg_employee_comments = payload.employeeComments;
      }
      if (payload.managerComments !== undefined) {
        data.aemg_manager_comments = payload.managerComments;
      }
      if (payload.midYearManagerComments !== undefined) {
        data.aemg_mid_year_manager_comments = payload.midYearManagerComments;
      }
      if (payload.managerOverallOverride !== undefined) {
        data.aemg_manager_overall_override = payload.managerOverallOverride;
      }
      await call(actor, "hr_override_appraisal", { appraisal, data });
      break;
    }
  }

  return reread(actor, appraisal);
}

/** Create an appraisal for the acting employee; returns its ERPNext name. */
export async function createErpnextAppraisal(
  actor: Actor,
  cycleYear: number
): Promise<string> {
  const res = await erpnextApiCall<{ name: string }>(
    "appraisal.create_appraisal",
    { appraisal_cycle: `${cycleYear}-${cycleYear + 1} Annual Appraisal` },
    undefined,
    actor.employee
  );
  if (!res.ok) {
    if (res.kind === "PermissionError") throw new ErpnextForbiddenError(res.error);
    throw new ErpnextUnavailableError(res.error);
  }
  return res.data.name;
}
