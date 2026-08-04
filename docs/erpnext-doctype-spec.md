# AEMG EPM → ERPNext / HRMS DocType Spec

Porting the Next.js appraisal prototype onto ERPNext + HRMS as a standalone Frappe
app. The prototype keeps its dummy data and file store for dev testing; nothing
here changes `src/`.

**Verified against the live instance on 2026-07-20.** Field names below are read
from the running site, not assumed.

| | |
|---|---|
| Site | `http://20.11.179.179` (⚠️ plain HTTP — see §9) |
| frappe | 15.103.3 (version-15) |
| erpnext | 15.103.1 (version-15) |
| hrms | **15.58.7** (version-15) |
| Also installed | `custom_theme` (AEMG theme) · `aemg_integration` (AEMG Integration) |

---

## 0. Headline: HRMS already models ~80% of this

The earlier draft of this spec assumed AEMG's capability axis, scoring blend, and
peer feedback all needed custom DocTypes. **They don't.** Verification found HRMS
v15 covers them natively, and that someone has already seeded part of the config
on this instance.

| AEMG concept | Thought we needed | Actually |
|---|---|---|
| 5 capabilities | custom master + child table | `Employee Feedback Criteria` — **already seeded with the exact 5** |
| Capability ratings | custom child table | `Employee Feedback Rating` (`criteria`, `per_weightage`, `rating`) |
| 50/50 KPI+capability blend | Python override of `calculate_final_score` | `Appraisal Cycle.final_score_formula` — a config field |
| Branch-manager feedback | faked via `DEMO_BRANCH_MANAGER_COMMENTS` | `Employee Performance Feedback` (submittable) |
| `HR-APR-YYYY-NNNNN` doc id | synthesised from a hash | real `naming_series` = `HR-APR-.YYYY.-` |

**What is genuinely missing from HRMS: the mid-year checkpoint and the KPI
approval gate.** That is the entire custom surface. Everything else is
configuration plus a handful of custom fields.

This settles §1 decisively: **extend HRMS.** A standalone `AEMG Appraisal` would
mean rebuilding the capability model and scoring engine that already exist.

---

## 1. Current state of the instance

| DocType | Count | Notes |
|---|---|---|
| Employee | **266** | real data |
| Appraisal Cycle | 1 | `2026 Annual Appraisal`, 2026-01-01→12-31, company `AEMG EDUCATION`, status Not Started, method *Automated Based on Goal Progress* |
| Employee Feedback Criteria | **5** | Planning · Leadership · Financial Management · Strategic Execution · Communication — exact match for `CapabilityId` in `types.ts:98` |
| KRA | 15 | **junk test data** — `kppp`, `dthkyl;hgm`, `kopppppppp`, `KP1`…`KP90`. Needs cleaning |
| Appraisal | 0 | nothing created yet |
| Appraisal Template | 0 | none |
| Employee Performance Feedback | 0 | none |
| Custom Field (on appraisal doctypes) | **0** | clean slate |
| Employee Grade | 0 | no home for M-Level yet |
| Workflow | 0 | none defined |

Someone has clearly started this — the cycle and the five criteria are not
accidents. Worth finding out who and what their intent was before overwriting.

---

## 2. App shape

New app, separate repo, outside this one:

```
aemg_epm/
├── hooks.py                 # required_apps = ["erpnext", "hrms"]
├── aemg_epm/
│   ├── doctype/             # AEMG Mid Year Review (+ child)
│   ├── fixtures/            # Custom Field, Property Setter, Role, Workflow
│   ├── api/                 # whitelisted methods (state transitions)
│   └── overrides/           # permission query hooks
```

**Open question:** `aemg_integration` already exists on this site. I'd recommend a
*separate* `aemg_epm` app rather than extending it — an API-integration app and an
HR product app have different release cadences and different blast radii. But if
`aemg_integration` is already the agreed home for AEMG customisations, that's a
reasonable counter-argument. Needs your call.

Custom fields ship as **fixtures**, never hand-created in the UI.

---

## 3. Verified schema

### 3.1 `Appraisal` (module HR, **is_submittable = 1**)

```
naming_series      Select  HR-APR-.YYYY.-        reqd
employee           Link    Employee              reqd
employee_name      Data                          read_only
department         Link    Department            read_only
designation        Link    Designation           read_only
company            Link    Company               reqd
appraisal_cycle    Link    Appraisal Cycle       reqd
start_date/end_date Date                         read_only
appraisal_template Link    Appraisal Template
rate_goals_manually Check                        read_only
appraisal_kra      Table   Appraisal KRA         ← automated method
goals              Table   Appraisal Goal        ← manual method
goal_score_percentage Float                      read_only
remarks            Text
total_score        Float                         read_only
self_ratings       Table   Employee Feedback Rating
self_score         Float                         read_only
avg_feedback_score Float                         read_only, hidden
reflections        Text Editor
final_score        Float                         read_only
```

**There is no `Appraisal KPI` doctype.** There are two goal tables and you must
pick one, driven by `Appraisal Cycle.kra_evaluation_method`:

| | `appraisal_kra` (Appraisal KRA) | `goals` (Appraisal Goal) |
|---|---|---|
| KRA field | Link → `KRA` master | **Small Text** (free text) |
| Weight | `per_weightage` Percent | `per_weightage` Float |
| Score | `goal_completion`, `goal_score` | `score`, `score_earned` |
| Cycle method | *Automated Based on Goal Progress* | *Manual Rating* |

**Use `Appraisal Goal` + `kra_evaluation_method = "Manual Rating"`.** AEMG's
`goalsAndKpis` is free text authored per employee (`types.ts:83`), not selected
from a master. The existing cycle is currently set to *Automated* — **that needs
changing**, and the 15 junk KRA records suggest someone went down the automated
path first.

### 3.2 KPI mapping (`KpiRow` → `Appraisal Goal`)

| Prototype | Field | Notes |
|---|---|---|
| `goalsAndKpis` | `kra` (Small Text) | ✅ direct |
| `weightPercent` | `per_weightage` (Float) | ✅ both sum to 100 |
| `selfRating` | `score` | ⚠️ scale — see §5 |
| `managerRating` | `score_earned` | ⚠️ confirm semantics |
| `dueDate` | `aemg_due_date` | **custom** — not in HRMS |
| `midYearRating` | `aemg_mid_year_rating` | **custom** Select |
| `midYearComment` | `aemg_mid_year_comment` | **custom** Small Text |

### 3.3 Capabilities → `Employee Feedback Rating` (no custom doctype)

```
criteria       Link    Employee Feedback Criteria   reqd
per_weightage  Percent                              reqd
rating         Rating
```

`CapabilityRow` (`types.ts:105`) maps onto `Appraisal.self_ratings`. The five
criteria already exist with matching names. Two custom fields still needed for the
mid-year axis: `aemg_mid_year_rating`, `aemg_mid_year_comment`.

`src/lib/capability-framework.ts` (179 lines of capability × M-Level → description)
has no HRMS home. Make it a small custom DocType `AEMG Capability Descriptor`
(`criteria` Link, `m_level` Int, `description` Text) so HR can edit Appendix 1
without a deploy.

### 3.4 `Appraisal Cycle`

```
cycle_name, company, start_date, end_date          reqd
status                Select  Not Started / In Progress / Completed
kra_evaluation_method Select  Automated Based on Goal Progress / Manual Rating
calculate_final_score_based_on_formula  Check
final_score_formula   Code    PythonExpression
branch/department/designation  Link   (employee filters)
appraisees            Table   Appraisee
get_employees         Button
```

### 3.5 Custom fields to add

**On `Appraisal`:**

| Fieldname | Type | Purpose |
|---|---|---|
| `aemg_m_level` | Int (1–10) | fetch from Employee, `fetch_if_empty` so it snapshots |
| `aemg_entity` | Link → `AEMG Entity` | AFE / HQ Corporate Services / China Campus / VN & Health / ADSC |
| `aemg_kpi_status` | Select | `Not Started / KPI Created / KPI Approved` |
| `aemg_mid_year_status` | Select | `Not Started / Draft / Submitted / Completed` |
| `aemg_mid_year_manager_comments` | Small Text | |
| `aemg_manager_overall_override` | Int (1–5) | |

**Reuse, don't duplicate:** `employeeComments` → existing `reflections`;
`managerComments` → existing `remarks`.

**On `Appraisal Cycle`:** `aemg_kpi_submission_open`, `aemg_mid_year_review_open`,
`aemg_annual_review_open` (Check ×3) — the three `ReviewWindowSettings` booleans,
now per-cycle instead of global, which is strictly better.

**On `Employee`:** `aemg_m_level` (Int 1–10) and `aemg_entity`. `Employee Grade`
exists as a doctype but has **zero records**, so M-Level has no home today — a
custom Int field is simpler than seeding ten grades unless you want grade-based
payroll later.

### 3.6 Fields that disappear

`ownerUserId` → `employee` · `employeeName`/`englishName` → `Employee.employee_name`
· `position` → `designation` · `department` → `department` ·
`managerName`/`reviewingManagerId` → `Employee.reports_to`.

Deletes `src/lib/mock-users.ts` (150 lines) and `reviewingManagerIdForOwner`
entirely. Note the prototype's `overviewProfileForAppraisal` currently *overwrites*
stored values with the mock directory — that behaviour goes away, which is correct
but changes what the UI displays.

`src/lib/notification-store.ts` (117 lines) → Frappe Notification Log.

---

## 4. Status model

Two orthogonal axes in the prototype, and `midYearStatus` (`types.ts:12`) overloads
the KPI gate with the mid-year checkpoint. **Split them** — `aemg_kpi_status` and
`aemg_mid_year_status` above. Cheaper now than after data exists.

`Appraisal` is submittable, so the annual axis maps to docstatus:

| Prototype `status` | ERPNext |
|---|---|
| `draft` | docstatus 0 |
| `submitted` | docstatus 0 + workflow state |
| `reviewed` | docstatus 0 + workflow state |
| `completed` | **docstatus 1** (submitted) |

One Workflow on the annual axis; the two Select fields transitioned by whitelisted
methods with explicit role + state guards. Do **not** flatten both axes into one
~12-state workflow. Port the transition conditions verbatim from
`src/app/api/appraisals/[id]/route.ts` — that logic is correct and is the most
valuable thing in the prototype.

---

## 5. Scoring — config, not code

`Appraisal Cycle.final_score_formula` is a Python expression field. Its description
on the live site:

> By default, the Final Score is calculated as the average of Goal Score, Feedback
> Score, and Self Appraisal Score. Enable this to set a different formula

AEMG wants `(weighted KPI score + capability average) / 2` — expressible as a
formula. **No controller override needed.** This was the biggest assumed cost in
the earlier draft and it evaporates.

**Two things to resolve before trusting it:**

1. **Rating scale.** `Employee Feedback Rating.rating` is fieldtype `Rating`, which
   Frappe stores as a **0–1 float** (a 5-star widget writes 0.2/0.4/…/1.0). The
   prototype validates 1–5 integers (`appraisal-store.ts:272`). Either convert at
   the API boundary or use a Property Setter. Confirm by writing one test record —
   I could not confirm from schema alone, and there are zero existing Appraisals.
2. **`score` vs `score_earned`** on `Appraisal Goal` — which is self and which is
   manager is not obvious from field names. Needs one test record too.

**Carry over a fix, not the bug:** `weightedKpiScore(kpis, "manager")` currently
falls back to `selfRating` when a manager rating is missing (`kpi-utils.ts:23`),
silently blending self-assessment into the manager score. Return null instead.

---

## 6. Permissions — the missing half

The prototype has **no server-side authorization at all**: roles live in
`localStorage` (`src/contexts/session-context.tsx`) and every API route is
anonymous. This is the single largest thing ERPNext provides.

| Role | Access | Mechanism |
|---|---|---|
| Employee | own only | `Employee.user_id` + `get_permission_query_conditions` |
| Manager | own + direct reports | `Employee.reports_to` — needs the same hook |
| HR Manager | org-wide | existing HRMS role |
| HR / Super Admin | cycles + Appendix 1 masters | role on custom doctypes |

The `reports_to` hook is the real work. Plan for recursion if skip-level visibility
is needed — the prototype has a `DEMO_SKIP_LEVEL_MANAGER` placeholder marked
"pending Sam's confirmation", so it's unresolved on the business side.

---

## 7. Custom work actually required

Everything else is config. This is the build list:

1. `AEMG Mid Year Review` — or mid-year custom fields on `Appraisal` (see §3.5).
   The only genuinely absent concept.
2. KPI approval gate — `aemg_kpi_status` + two whitelisted transition methods.
3. `AEMG Capability Descriptor` — Appendix 1 text by M-Level.
4. `AEMG Entity` master (5 records).
5. Custom fields per §3.5, as fixtures.
6. `final_score_formula` for the 50/50 blend.
7. Permission query hook for `reports_to`.
8. One Workflow on the annual axis.

---

## 8. Instance cleanup before building

- **15 junk KRA records** (`kppp`, `dthkyl;hgm`, `kopppppppp`, …) — delete.
- **Cycle is set to *Automated Based on Goal Progress*** — must become *Manual
  Rating* for free-text KPIs (§3.1).
- No `Appraisal Template` exists — decide whether AEMG uses templates at all
  (probably not, since KPIs are authored per employee).
- Confirm the 266 Employees have `user_id` populated — without it, employees
  cannot log in and no permission rule can match them.
- Confirm `reports_to` is populated — the entire manager permission model depends
  on it, and the prototype's hierarchy was pure mock.

---

## 9. Security items for pre-production

- **Site is plain HTTP on a bare IP.** API keys and employee records travel
  unencrypted. Needs TLS + hostname, and should not be publicly reachable.
- **Rotate the API key** used for this verification — it was shared in chat.
- The prototype's demo auth (password ignored, role in `localStorage`) must not
  survive contact with real employee data.

---

## 10. Remaining unknowns

Schema-level verification is complete. These need a **test record**, not more
reading:

1. `Rating` fieldtype storage — 0–1 float or 1–5 int? (§5)
2. `Appraisal Goal.score` vs `score_earned` — which is self, which is manager?
3. Does `final_score_formula` have access to per-goal weights, or only aggregates?
4. Does submitting an `Appraisal` (docstatus 1) lock child tables as needed?

And one business question: **who created the `2026 Annual Appraisal` cycle and the
five criteria, and what was the intended approach?** Worth knowing before changing
the evaluation method out from under them.
