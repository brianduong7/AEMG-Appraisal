import { migrateAppraisal } from "@/lib/migrate-appraisal";
import type {
  Appraisal,
  CapabilityId,
  CapabilityRow,
  KpiRow,
  MidYearRating,
} from "@/lib/types";
import { CAPABILITY_ORDER } from "@/lib/types";

/** Stable ids — one per ERP-style demo employee (HR inbox). */
export const DEMO_HR_SEED_IDS = {
  kevinChen: "00000000-0000-4000-8000-000000000009",
  vivianWang: "00000000-0000-4000-8000-000000000010",
  thomasPower: "00000000-0000-4000-8000-000000000011",
  amyNgo: "00000000-0000-4000-8000-000000000012",
  iainWatt: "00000000-0000-4000-8000-000000000070",
  sarahLim: "00000000-0000-4000-8000-000000000013",
  jamesWu: "00000000-0000-4000-8000-000000000014",
  priyaSharma: "00000000-0000-4000-8000-000000000015",
  michaelZhang: "00000000-0000-4000-8000-000000000016",
  lisaTran: "00000000-0000-4000-8000-000000000017",
} as const;

const DEMO_MID_YEAR_ROTATION: MidYearRating[] = [
  "on_track",
  "on_track",
  "not_on_track",
  "early_access",
];

const DEMO_MID_YEAR_KPI_COMMENTS: Record<MidYearRating, string> = {
  on_track:
    "On track at mid-year — evidence reviewed in the one-on-one; keep current pace into H2.",
  not_on_track:
    "Not on track at mid-year — agreed recovery actions and a follow-up check-in before annual.",
  early_access:
    "Too early to access at mid-year — KPI timing lands in H2; revisit at annual review.",
};

const DEMO_MID_YEAR_CAP_COMMENTS = [
  "Solid planning discipline through mid-year; maintain cadence.",
  "Leadership presence growing — continue mentoring juniors in H2.",
  "Budget ownership clear; flag any Q4 variance early.",
  "Strategic priorities aligned after mid-year recalibration.",
  "Communication with stakeholders has been consistent.",
];

function kpi(
  goalsAndKpis: string,
  weightPercent: number,
  dueDate: string,
  selfRating: number,
  managerRating: number,
  kpiIndex = 0
): KpiRow {
  const midYearRating = DEMO_MID_YEAR_ROTATION[kpiIndex % DEMO_MID_YEAR_ROTATION.length]!;
  return {
    goalsAndKpis,
    weightPercent,
    dueDate,
    selfRating,
    managerRating,
    managerComments: "",
    midYearRating,
    midYearComment: DEMO_MID_YEAR_KPI_COMMENTS[midYearRating],
  };
}

function capabilities(
  self: number[],
  manager: number[]
): CapabilityRow[] {
  return CAPABILITY_ORDER.map((id: CapabilityId, i) => ({
    id,
    selfRating: self[i] ?? 3,
    managerRating: manager[i] ?? 3,
    managerComments: "",
    /* Mid-year capability: manager comment only (no employee rating). */
    midYearRating: null,
    midYearComment: DEMO_MID_YEAR_CAP_COMMENTS[i] ?? "Mid-year capability note.",
  }));
}

type DemoHrSeedRaw = Parameters<typeof migrateAppraisal>[0];

const DEMO_HR_COMPLETED_RAW: DemoHrSeedRaw[] = [
  {
    id: DEMO_HR_SEED_IDS.kevinChen,
    ownerUserId: "erp-00009",
    reviewingManagerId: null,
    employeeName: "KevinChen 陈凯",
    englishName: "Kevin Chen",
    position: "English Teacher",
    department: "ELICOS",
    mLevel: 3,
    managerName: "Vivian 王睿",
    entity: "AFE",
    status: "completed",
    kpis: [
      kpi(
        "Deliver ELICOS lessons aligned to CEFR outcomes; achieve ≥85% student pass rate on internal assessments.",
        40,
        "2026-06-30",
        4,
        4
      ),
      kpi(
        "Complete weekly lesson planning and submit materials 48 hours before class.",
        25,
        "2026-12-31",
        4,
        3
      ),
      kpi(
        "Participate in peer observation program — observe 2 colleagues and host 2 observations.",
        20,
        "2026-09-30",
        3,
        4
      ),
      kpi(
        "Support student welfare check-ins and escalate at-risk learners per campus protocol.",
        15,
        "2026-12-31",
        4,
        4
      ),
    ],
    capabilities: capabilities([3, 3, 3, 4, 4], [3, 4, 3, 4, 4]),
    employeeComments:
      "Strong year in the classroom — student feedback was positive across both intakes.",
    managerComments:
      "Reliable teacher with improving classroom engagement. Continue building assessment moderation skills.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.vivianWang,
    ownerUserId: "erp-00010",
    reviewingManagerId: null,
    employeeName: "Vivian 王睿",
    englishName: "Vivian Wang",
    position: "Head of ELICOS",
    department: "Academic Delivery",
    mLevel: 6,
    managerName: "Iain Watt",
    entity: "China Campus",
    status: "completed",
    kpis: [
      kpi(
        "Lead ELICOS academic quality cycle — curriculum review, moderation, and teacher calibration completed Q2.",
        35,
        "2026-06-30",
        5,
        5
      ),
      kpi(
        "Improve student progression to mainstream programs by 8% vs prior year baseline.",
        30,
        "2026-12-31",
        4,
        4
      ),
      kpi(
        "Roll out new teacher onboarding playbook across China Campus ELICOS team.",
        20,
        "2026-08-31",
        4,
        5
      ),
      kpi(
        "Manage ELICOS budget variance within ±3% for the academic year.",
        15,
        "2026-12-31",
        4,
        4
      ),
    ],
    capabilities: capabilities([4, 5, 4, 5, 5], [5, 5, 4, 5, 5]),
    employeeComments:
      "Proud of the team’s delivery through a demanding intake calendar and staffing changes.",
    managerComments:
      "Outstanding leadership of ELICOS. Vivian sets clear standards and develops her leads well.",
    managerOverallOverride: 5,
  },
  {
    id: DEMO_HR_SEED_IDS.thomasPower,
    ownerUserId: "erp-00011",
    reviewingManagerId: null,
    employeeName: "Thomas Power",
    englishName: "Thomas Power",
    position: "House Master",
    department: "Student Experience",
    mLevel: 5,
    managerName: "Dr. Amy Ngo",
    entity: "AFE",
    status: "completed",
    kpis: [
      kpi(
        "Maintain residential wellbeing program — 95% completion of scheduled house activities per term.",
        30,
        "2026-12-31",
        4,
        4
      ),
      kpi(
        "Reduce critical incident escalations by 15% through proactive house mentoring.",
        35,
        "2026-10-31",
        3,
        4
      ),
      kpi(
        "Partner with academic leads on attendance interventions for at-risk boarders.",
        20,
        "2026-09-30",
        4,
        4
      ),
      kpi(
        "Complete house master compliance training and staff supervision logs on time.",
        15,
        "2026-06-30",
        5,
        4
      ),
    ],
    capabilities: capabilities([4, 4, 3, 4, 4], [4, 4, 3, 4, 4]),
    employeeComments:
      "Invested heavily in student connection this year, especially for new international arrivals.",
    managerComments:
      "Strong pastoral leadership. Thomas is visible to students and collaborates well across teams.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.amyNgo,
    ownerUserId: "erp-00012",
    reviewingManagerId: null,
    employeeName: "Dr. Amy Ngo",
    englishName: "Dr. Amy Ngo",
    position: "Year 2 EAP Curriculum Specialist",
    department: "Curriculum & Quality",
    mLevel: 5,
    managerName: "Iain Watt",
    entity: "ADSC",
    status: "completed",
    kpis: [
      kpi(
        "Publish revised Year 2 EAP curriculum map and assessment rubrics for academic board approval.",
        40,
        "2026-05-31",
        5,
        5
      ),
      kpi(
        "Facilitate moderation workshops — 100% of Year 2 EAP teachers complete calibration.",
        25,
        "2026-08-31",
        4,
        4
      ),
      kpi(
        "Pilot blended learning enhancements in two core modules; capture student outcome data.",
        20,
        "2026-11-30",
        4,
        4
      ),
      kpi(
        "Contribute to accreditation evidence pack for EAP pathway (sections 3–5).",
        15,
        "2026-12-31",
        4,
        5
      ),
    ],
    capabilities: capabilities([5, 4, 4, 5, 5], [5, 4, 4, 5, 5]),
    employeeComments:
      "Curriculum refresh landed on schedule; grateful for cross-campus input from ELICOS leads.",
    managerComments:
      "Excellent subject expertise and stakeholder management. Ready for broader program ownership.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.iainWatt,
    ownerUserId: "erp-00070",
    reviewingManagerId: null,
    employeeName: "Iain Watt",
    englishName: "Iain Watt",
    position: "President — AIFE",
    department: "Executive Office",
    mLevel: 9,
    managerName: "Board Chair",
    entity: "HQ Corporate Services",
    status: "completed",
    kpis: [
      kpi(
        "Deliver annual strategic plan milestones — campus expansion, partnership MOUs, and governance refresh.",
        40,
        "2026-12-31",
        5,
        5
      ),
      kpi(
        "Lead institution-wide performance culture program with ExCo and HR.",
        25,
        "2026-09-30",
        4,
        5
      ),
      kpi(
        "Strengthen financial sustainability — operating margin within board-approved range.",
        20,
        "2026-12-31",
        4,
        4
      ),
      kpi(
        "Represent AIFE with government, industry partners, and accreditation bodies.",
        15,
        "2026-12-31",
        5,
        5
      ),
    ],
    capabilities: capabilities([5, 5, 5, 5, 5], [5, 5, 5, 5, 5]),
    employeeComments:
      "A demanding year with strong institutional outcomes; thankful for ExCo alignment.",
    managerComments:
      "President performance exceeded expectations across strategy, culture, and external engagement.",
    managerOverallOverride: 5,
  },
  {
    id: DEMO_HR_SEED_IDS.sarahLim,
    ownerUserId: "erp-00013",
    reviewingManagerId: null,
    employeeName: "Sarah Lim",
    englishName: "Sarah Lim",
    position: "Student Services Coordinator",
    department: "Student Experience",
    mLevel: 3,
    managerName: "Thomas Power",
    entity: "VN & Health",
    status: "completed",
    kpis: [
      kpi(
        "Process orientation and visa-support enquiries within 2 business days (95% SLA).",
        35,
        "2026-12-31",
        4,
        4
      ),
      kpi(
        "Coordinate monthly student events — attendance target 70% of on-campus cohort.",
        30,
        "2026-12-31",
        4,
        3
      ),
      kpi(
        "Maintain accurate student records in SIS; zero critical audit findings.",
        35,
        "2026-06-30",
        5,
        5
      ),
    ],
    capabilities: capabilities([4, 3, 3, 3, 4], [4, 3, 4, 3, 4]),
    employeeComments: "Enjoyed supporting our Vietnam campus intake — busy but rewarding.",
    managerComments: "Consistent service delivery. Continue developing initiative on event design.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.jamesWu,
    ownerUserId: "erp-00014",
    reviewingManagerId: null,
    employeeName: "James Wu",
    englishName: "James Wu",
    position: "IT Systems Analyst",
    department: "Technology",
    mLevel: 4,
    managerName: "Group CIO",
    entity: "HQ Corporate Services",
    status: "completed",
    kpis: [
      kpi(
        "Complete ERPNext HR module integration phase 1 — employee master and appraisal workflow UAT.",
        45,
        "2026-08-31",
        4,
        5
      ),
      kpi(
        "Reduce P1 incident mean time to resolve by 20% across corporate systems.",
        30,
        "2026-12-31",
        4,
        4
      ),
      kpi(
        "Document system runbooks for finance and HR interfaces.",
        25,
        "2026-10-31",
        3,
        4
      ),
    ],
    capabilities: capabilities([4, 3, 4, 4, 3], [4, 3, 4, 5, 4]),
    employeeComments: "Good progress on HRIS integration despite vendor delays.",
    managerComments: "Strong technical delivery on appraisal integration. Communication improving.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.priyaSharma,
    ownerUserId: "erp-00015",
    reviewingManagerId: null,
    employeeName: "Priya Sharma",
    englishName: "Priya Sharma",
    position: "Nursing Clinical Educator",
    department: "Health Sciences",
    mLevel: 4,
    managerName: "Dean of Health",
    entity: "VN & Health",
    status: "completed",
    kpis: [
      kpi(
        "Supervise clinical placements — 100% of students meet competency sign-off before graduation.",
        40,
        "2026-11-30",
        5,
        5
      ),
      kpi(
        "Update simulation lab scenarios aligned to new accreditation standards.",
        30,
        "2026-07-31",
        4,
        4
      ),
      kpi(
        "Mentor two junior educators through structured observation cycles.",
        30,
        "2026-12-31",
        4,
        5
      ),
    ],
    capabilities: capabilities([4, 4, 3, 4, 4], [5, 5, 3, 4, 4]),
    employeeComments: "Clinical cohort outcomes were strong; placement partners gave positive feedback.",
    managerComments: "Exemplary clinical leadership. Priya is a role model for the health faculty.",
    managerOverallOverride: 5,
  },
  {
    id: DEMO_HR_SEED_IDS.michaelZhang,
    ownerUserId: "erp-00016",
    reviewingManagerId: null,
    employeeName: "Michael Zhang",
    englishName: "Michael Zhang",
    position: "Marketing Manager",
    department: "Marketing & Admissions",
    mLevel: 5,
    managerName: "Iain Watt",
    entity: "China Campus",
    status: "completed",
    kpis: [
      kpi(
        "Deliver China intake campaign — achieve enrolment target for ELICOS and pathway programs.",
        40,
        "2026-03-31",
        4,
        3
      ),
      kpi(
        "Launch refreshed digital presence — website conversion rate +12% YoY.",
        35,
        "2026-09-30",
        4,
        4
      ),
      kpi(
        "Manage campaign budget within approved spend; monthly variance reporting.",
        25,
        "2026-12-31",
        3,
        4
      ),
    ],
    capabilities: capabilities([4, 4, 4, 4, 5], [4, 3, 4, 4, 4]),
    employeeComments: "Campaign results mixed on Q1 intake but digital metrics improved.",
    managerComments:
      "Met most targets; needs sharper pipeline forecasting for H2. Good stakeholder communication.",
    managerOverallOverride: null,
  },
  {
    id: DEMO_HR_SEED_IDS.lisaTran,
    ownerUserId: "erp-00017",
    reviewingManagerId: null,
    employeeName: "Lisa Tran",
    englishName: "Lisa Tran",
    position: "HR Business Partner",
    department: "Human Resources",
    mLevel: 5,
    managerName: "Group CHRO",
    entity: "HQ Corporate Services",
    status: "completed",
    kpis: [
      kpi(
        "Roll out annual appraisal cycle — 98% completion rate across AIFE entities.",
        40,
        "2026-12-31",
        5,
        5
      ),
      kpi(
        "Support manager capability workshops on performance conversations (≥90% attendance).",
        30,
        "2026-10-31",
        4,
        5
      ),
      kpi(
        "Reduce time-to-fill for critical roles by 15% vs prior year.",
        30,
        "2026-12-31",
        4,
        4
      ),
    ],
    capabilities: capabilities([5, 4, 4, 5, 5], [5, 5, 4, 5, 5]),
    employeeComments:
      "Appraisal rollout was the highlight — strong partnership with IT and ExCo.",
    managerComments:
      "Lisa drove appraisal adoption exceptionally well. Trusted HRBP across the group.",
    managerOverallOverride: null,
  },
];

export function buildDemoHrCompletedAppraisals(): Appraisal[] {
  return DEMO_HR_COMPLETED_RAW.map((raw) => {
    const base = migrateAppraisal(raw);
    return {
      ...base,
      midYearStatus: "completed" as const,
      midYearManagerComments:
        "Mid-year checkpoint held on schedule. KPIs reviewed one-on-one; priorities confirmed for the second half of the cycle.",
      kpis: base.kpis.map((k, i) => {
        const midYearRating =
          DEMO_MID_YEAR_ROTATION[i % DEMO_MID_YEAR_ROTATION.length]!;
        return {
          ...k,
          midYearRating,
          midYearComment: DEMO_MID_YEAR_KPI_COMMENTS[midYearRating],
        };
      }),
      capabilities: base.capabilities.map((c, i) => ({
        ...c,
        midYearRating: null,
        midYearComment:
          DEMO_MID_YEAR_CAP_COMMENTS[i] ?? "Mid-year capability note.",
      })),
    };
  });
}

export function demoHrSeedOwnerIds(): string[] {
  return DEMO_HR_COMPLETED_RAW.map((r) =>
    String((r as { ownerUserId: string }).ownerUserId)
  );
}
