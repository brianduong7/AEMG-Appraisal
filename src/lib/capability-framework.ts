import type { CapabilityId } from "./types";
import { CAPABILITY_ORDER } from "./types";

/**
 * Appendix 1 — AEMG Capability Framework (by M level × competency).
 * L3 Planning text matches the form example; other cells are concise level-appropriate expectations.
 */
/** Full Appendix 1 matrix by M level (exported for reference table). */
export const FRAMEWORK_BY_LEVEL: Record<number, Record<CapabilityId, string>> = {
  1: {
    planning:
      "Follows day-to-day tasks and simple instructions; asks for help to prioritise when unclear.",
    leadership:
      "Supports team tone; listens and responds professionally to colleagues and stakeholders.",
    financial_management:
      "Uses budgets and expense guidance with supervision; flags anomalies early.",
    strategic_execution:
      "Executes assigned steps reliably; understands how own work links to team outputs.",
    communication:
      "Shares updates clearly with prompt support; checks understanding on key messages.",
  },
  2: {
    planning:
      "Tracks personal deliverables against team plans; raises risks and dependencies in stand-ups.",
    leadership:
      "Collaborates across roles; models reliability and constructive feedback among peers.",
    financial_management:
      "Monitors cost drivers for own scope; supports forecasting inputs for the team.",
    strategic_execution:
      "Delivers work packages on time; suggests small improvements to processes.",
    communication:
      "Prepares concise written updates; adapts tone for internal audiences.",
  },
  3: {
    planning:
      "Develops simple project plans; identifies tasks, dependencies and resources; adjusts to shifting requirements.",
    leadership:
      "Coordinates a small group; sets clear expectations and follows through on commitments.",
    financial_management:
      "Builds and tracks basic budgets for projects; explains variances in plain language.",
    strategic_execution:
      "Turns priorities into executable plans; removes blockers within remit and escalates when needed.",
    communication:
      "Facilitates routine meetings; ensures actions and owners are captured and communicated.",
  },
  4: {
    planning:
      "Owns multi-track plans across teams; balances capacity, risk and stakeholder deadlines.",
    leadership:
      "Coaches others; handles conflict fairly and reinforces standards and culture.",
    financial_management:
      "Owns P&L or cost centre elements; drives efficiency and investment trade-offs.",
    strategic_execution:
      "Aligns programmes to business strategy; reallocates focus as conditions change.",
    communication:
      "Represents the function to senior forums; tailors narrative for executive decisions.",
  },
  5: {
    planning:
      "Sets annual/rolling priorities for a unit; integrates portfolio dependencies and governance.",
    leadership:
      "Builds leadership bench strength; holds leaders accountable for outcomes and values.",
    financial_management:
      "Shapes budget strategy for the unit; links financial outcomes to strategic bets.",
    strategic_execution:
      "Drives execution across regions/functions; makes trade-offs to protect strategic intent.",
    communication:
      "Aligns organisation on direction; communicates change with clarity and empathy.",
  },
  6: {
    planning:
      "Integrates enterprise planning cycles; anticipates market and regulatory shifts in roadmaps.",
    leadership:
      "Shapes leadership culture at scale; sponsors diversity, succession and performance rigour.",
    financial_management:
      "Guides capital allocation narratives; challenges assumptions on returns and risk.",
    strategic_execution:
      "Connects corporate strategy to operating reality; sponsors major transformation moves.",
    communication:
      "Acts as visible sponsor for enterprise messages; manages sensitive stakeholder dynamics.",
  },
  7: {
    planning:
      "Sets multi-year horizons; balances growth, resilience and capability build across the group.",
    leadership:
      "Influences executive peers; models integrity and decisive leadership on complex issues.",
    financial_management:
      "Stewardship of group financial health; frames investment cases for board-level choices.",
    strategic_execution:
      "Positions the organisation competitively; commits resources to strategic pivots.",
    communication:
      "Articulates group narrative to investors, regulators and partners with consistency.",
  },
  8: {
    planning:
      "Frames scenarios for the enterprise; ensures planning systems support agility and control.",
    leadership:
      "Sets tone from the top; champions ethical leadership and crisis judgement.",
    financial_management:
      "Oversees financial resilience and long-range capital strategy across portfolios.",
    strategic_execution:
      "Owns enterprise outcomes; aligns M&A, portfolio and operating model to vision.",
    communication:
      "Defines signature communications in high-stakes moments; protects organisational trust.",
  },
  9: {
    planning:
      "Guards long-term mission while adapting plans; balances stakeholders across geographies.",
    leadership:
      "Empowers the executive system; resolves enterprise-level leadership tensions.",
    financial_management:
      "Ultimate accountability for sustainable financial performance and governance.",
    strategic_execution:
      "Commits the organisation to bold moves; balances innovation with operational discipline.",
    communication:
      "Embodies the organisation’s voice externally; aligns internal narrative to strategy.",
  },
  10: {
    planning:
      "Sets the enterprise’s planning doctrine; ensures ambition, risk and stewardship align.",
    leadership:
      "Exemplifies purpose-led leadership; holds the organisation to its values and standards.",
    financial_management:
      "Board-level accountability for financial soundness, transparency and stakeholder returns.",
    strategic_execution:
      "Determines strategic destiny; makes final calls on scale, scope and partnerships.",
    communication:
      "Represents the institution at the highest levels; inspires confidence and clarity.",
  },
};

export const M_LEVEL_LABELS: Record<number, string> = {
  1: "L1 — Assistant / Entry Level",
  2: "L2 — Junior Coordinator / Specialist",
  3: "L3 — Coordinator / Analyst / Supervisor",
  4: "L4 — Senior Manager / Regional Manager / Director",
  5: "L5 — Unit Director / Acting Director / Deputy Director",
  6: "L6 — Senior Director / Head of Function",
  7: "L7 — Executive Director / VP",
  8: "L8 — Senior Executive / C-suite",
  9: "L9 — Group Executive",
  10: "L10 — Council / Board / Director General / Group President",
};

export function capabilityDescription(
  mLevel: number,
  id: CapabilityId
): string {
  const level = Math.min(10, Math.max(1, Math.round(mLevel)));
  return FRAMEWORK_BY_LEVEL[level]?.[id] ?? "—";
}

export function capabilityTitle(id: CapabilityId): string {
  const titles: Record<CapabilityId, string> = {
    planning: "Planning",
    leadership: "Leadership",
    financial_management: "Financial Management",
    strategic_execution: "Strategic Execution",
    communication: "Communication",
  };
  return titles[id];
}

export function orderedFrameworkRowIds(): CapabilityId[] {
  return [...CAPABILITY_ORDER];
}

/** Table order: highest level first (matches printed appendix). */
export const APPENDIX_LEVELS_DESCENDING = [
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
] as const;

/** Text after "L{n} — " in `M_LEVEL_LABELS` for the Typical Role column. */
export function typicalRoleForMLevel(level: number): string {
  const n = Math.min(10, Math.max(1, Math.round(level)));
  const full = M_LEVEL_LABELS[n] ?? "";
  const parts = full.split(" — ");
  return parts.length > 1 ? parts[1]!.trim() : full;
}
