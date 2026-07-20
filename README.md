# AEMG EPM — Employee Performance Management System

Appraisal portal for **AIFE / AEMG Education Group**. Employees set KPIs, complete mid-year checkpoints, and finish annual reviews; managers approve and rate; HR controls cycle windows and org-wide visibility.

**Repo:** [FLYONIT-Systems/AEMG-EPM](https://github.com/FLYONIT-Systems/AEMG-EPM)

---

## What it does

| Role | Capabilities |
|------|----------------|
| **Employee** | Create KPIs (3–6, weights = 100%), submit for approval, mid-year On Track ratings, annual self-ratings |
| **Manager** | Approve KPIs, mid-year comments, annual 1–5 ratings, complete appraisal to HR |
| **HR / Super Admin** | Org-wide list, Admin Settings (lock/unlock KPI / Mid-Year / Annual windows) |

### Cycle flow (high level)

1. **KPI setup** — Employee drafts & submits KPIs → Mid-Year Status **KPI Created** → Manager **Approve KPIs** → **KPI Approved**
2. **Mid-Year** (when HR unlocks) — Employee On Track ratings → Manager comments → Mid-Year **Completed**
3. **Annual** (when HR unlocks) — Employee self-ratings → Manager ratings → Reviewed → Complete Appraisal

HR **Admin Settings** (`/?view=settings`) toggles three global windows: KPI submission, Mid-Year Review, Annual Review.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- Local JSON / in-memory store for appraisals, notifications, and review-window settings (demo / early hosting — replace with a real DB for production)

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with `APPRAISAL_STORE=file` (persists under `/data`) |
| `npm run build` | Production build |
| `npm start` | Run production build (`next start`) |
| `npm run lint` | ESLint |

### Demo logins

Password is ignored in the current demo auth.

| Role | Email |
|------|--------|
| Employee | `emma@aemg.demo` |
| Manager | `mark@aemg.demo` |
| HR / Super Admin | `hr@aemg.demo` |

---

## Environment

| Variable | Meaning |
|----------|---------|
| `APPRAISAL_STORE=file` | Persist appraisals/settings/notifications as JSON under `data/` (default in `npm run dev`) |
| `APPRAISAL_STORE=memory` | In-memory only (lost on restart; typical on ephemeral hosts unless overridden) |
| `DISABLE_DEMO_APPRAISAL_SEED=1` | Skip pre-seeded demo appraisals |

On multi-instance App Service, file store is **not** safe for production — use a shared database before go-live.

---

## Project layout (main)

```
src/app/                 # Next.js routes + API
src/components/          # UI (login, home, appraisal detail, sidebar, settings)
src/lib/                 # Types, stores, demo seeds, nav/roles
src/contexts/            # Session / role
public/logos/            # AIFE branding
data/                    # Local file store (gitignored)
```

---

## Hosting notes (Azure App Service)

- Runtime: **Node 20 or 22 LTS**, **Linux**, publish as **Code**
- Build: `npm ci && npm run build` → start: `npm start`
- Suggested prod plan: **Premium v3 (P1v3+)**; Basic B1 is only for early smoke tests
- Before production: Entra/SSO auth, real DB, turn off demo seeds

---

## Status

Active product build toward production. Demo login and file/memory storage are interim; replace for live AEMG use.
