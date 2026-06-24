import type { CapabilityId } from "./types";
import { CAPABILITY_ORDER } from "./types";

/**
 * Appendix 1 — AEMG Capability Framework (M level × competency).
 * Cell text aligned to the official appendix: Typical Role + five capability columns.
 */
/** Full Appendix 1 matrix by M level (exported for reference table). */
export const FRAMEWORK_BY_LEVEL: Record<number, Record<CapabilityId, string>> = {
  1: {
    planning:
      "Follows basic schedules and procedures; completes individual work to agreed standards.",
    leadership:
      "No team-lead remit; focuses on own tasks while working constructively with colleagues.",
    financial_management:
      "Understands basic budgeting terms; follows expenditure guidance with supervision.",
    strategic_execution:
      "Executes assigned tasks within predefined plans; stays aligned with team priorities.",
    communication:
      "Communicates clearly with colleagues; checks understanding on key messages.",
  },
  2: {
    planning:
      "Assists in planning under supervision; tracks personal deliverables against agreed timelines.",
    leadership:
      "Supports small task groups; contributes to shared goals, handovers and team tone.",
    financial_management:
      "Tracks expenditure for own scope; flags variances and supports basic reporting inputs.",
    strategic_execution:
      "Supports operational initiatives; implements assigned steps reliably.",
    communication:
      "Communicates with internal teams; shares status, risks and blockers in a timely way.",
  },
  3: {
    planning:
      "Develops simple project plans; coordinates tasks, dependencies and resources; adjusts to shifting requirements.",
    leadership:
      "Coordinates small teams; sets clear expectations and follows through on commitments.",
    financial_management:
      "Prepares basic financial reports; explains variances in plain language for projects or team budgets.",
    strategic_execution:
      "Implements tactical plans; removes blockers within remit and escalates when needed.",
    communication:
      "Communicates across teams; facilitates routine meetings and records actions and owners.",
  },
  4: {
    planning:
      "Executes supervisor's requirements; translates goals into actionable plans and tracks outcomes; adapts timelines and priorities.",
    leadership:
      "Leads small teams or projects; provides guidance and resolves minor issues; stays adaptive and resilient to change.",
    financial_management:
      "Interprets financial data; offers insights to improve cost-efficiency; adapts spending as constraints shift.",
    strategic_execution:
      "Plans short-term initiatives; aligns tasks with strategic goals; manages change at team level.",
    communication:
      "Presents ideas to stakeholders; tailors messaging for academic and professional audiences; helps others navigate ambiguity.",
  },
  5: {
    planning:
      "Develops operational plans for units or programs; balances resources and reprioritizes as information changes.",
    leadership:
      "Manages team performance; conducts reviews, sets goals and fosters accountability and adaptability.",
    financial_management:
      "Manages budgets and forecasts; makes decisions on resource allocation to meet changing requirements.",
    strategic_execution:
      "Executes departmental strategies; tracks KPIs and adjusts plans as required.",
    communication:
      "Influences team and peers; communicates expectations and motivates others; provides clarity during change.",
  },
  6: {
    planning:
      "Aligns planning with organizational goals; integrates priorities across the function or business unit.",
    leadership:
      "Builds high-performing teams; sponsors performance, development and succession within the unit.",
    financial_management:
      "Makes financial decisions within the unit; owns budgets and investment trade-offs for the scope.",
    strategic_execution:
      "Drives strategic initiatives; connects operating plans to enterprise or division strategy.",
    communication:
      "Communicates with senior leaders; represents the unit in cross-functional and executive forums.",
  },
  7: {
    planning:
      "Leads cross-functional planning; balances academic and operational priorities across multiple areas.",
    leadership:
      "Coaches and mentors managers; reinforces culture, standards and accountability at scale.",
    financial_management:
      "Oversees financial performance for the division or campus; challenges assumptions and drives sustainable outcomes.",
    strategic_execution:
      "Translates strategy into execution; sponsors major programs and reallocates focus as strategy shifts.",
    communication:
      "Communicates with executive teams and wider stakeholders; aligns narratives for change and governance.",
  },
  8: {
    planning:
      "Develops strategic plans for divisions; integrates market, regulatory and organizational context into roadmaps.",
    leadership:
      "Shapes organizational culture; sets leadership expectations and resolves complex people issues.",
    financial_management:
      "Makes investment decisions for the division; links capital, returns and risk in executive narratives.",
    strategic_execution:
      "Leads enterprise-wide initiatives from the division; drives transformation and operating-model change.",
    communication:
      "Communicates vision and direction; mobilizes leaders and staff around strategy with clear, consistent messaging.",
  },
  9: {
    planning:
      "Oversees strategic vision; guards multi-year horizons while adapting plans to market and stakeholder shifts.",
    leadership:
      "Builds leadership pipelines; strengthens executive teamwork and resolves enterprise-level leadership tensions.",
    financial_management:
      "Sets financial strategy for the group or major portfolio; frames investment and risk choices at the highest level.",
    strategic_execution:
      "Drives transformation programs; commits resources to strategic pivots and monitors enterprise outcomes.",
    communication:
      "Influences internal and external stakeholders; aligns partners, regulators and investors with organizational direction.",
  },
  10: {
    planning:
      "Sets organizational direction; ensures planning systems balance ambition, risk and stewardship at the highest level.",
    leadership:
      "Governance oversight of leadership and culture; holds the institution to its values, ethics and performance standards.",
    financial_management:
      "Board-level financial stewardship; accountability for transparency, sustainability and stakeholder returns.",
    strategic_execution:
      "Endorses strategic execution; makes final calls on scale, scope, partnerships and major commitments.",
    communication:
      "Represents the organization publicly; inspires confidence and clarity with government, partners and communities.",
  },
};

export const M_LEVEL_LABELS: Record<number, string> = {
  1: "L1 — Assistant / Entry-Level",
  2: "L2 — Junior Coordinator / Specialist",
  3: "L3 — Coordinator / Analyst / Supervisor",
  4: "L4 — Senior Manager / Regional Manager / Manager",
  5: "L5 — (Regional/Business line) Director / Acting Director / Deputy Director",
  6: "L6 — Department Director / BMs C+",
  7: "L7 — Dean / Registrar / Associate Executive Dean",
  8: "L8 — Deputy VP / Executive Dean",
  9: "L9 — Vice President / Group Executive",
  10: "L10 — Council / Board Member / Director General / Group President",
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
