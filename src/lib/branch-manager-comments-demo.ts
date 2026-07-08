export type BranchManagerComment = {
  id: string;
  branch: string;
  managerName: string;
  role: string;
  recordedAt: string;
  comment: string;
};

/** Demo-only branch manager notes (not stored on appraisal record). */
export const DEMO_BRANCH_MANAGER_COMMENTS: BranchManagerComment[] = [
  {
    id: "bm-1",
    branch: "AFE — Melbourne",
    managerName: "Sarah Chen",
    role: "Branch Manager",
    recordedAt: "2026-03-12",
    comment:
      "Kevin has been consistent in classroom delivery this cycle. Students in Block B reported clearer explanations of assessment criteria. Recommend continuing peer observation with senior teachers in Term 3.",
  },
  {
    id: "bm-2",
    branch: "China Campus — Shanghai",
    managerName: "Wei Lin",
    role: "Branch Manager",
    recordedAt: "2026-04-02",
    comment:
      "Strong collaboration with the ELICOS academic lead during the March intake. Attendance follow-up was proactive. Minor improvement area: faster turnaround on placement concern escalations.",
  },
  {
    id: "bm-3",
    branch: "HQ Corporate Services — Sydney",
    managerName: "David Park",
    role: "Regional Branch Manager",
    recordedAt: "2026-05-18",
    comment:
      "Supports cross-campus projects reliably and communicates risks early. Branch KPIs for student experience were met. Endorsed for continued development at current M level.",
  },
];
