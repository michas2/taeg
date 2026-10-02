# taeg — project & billing manager

A small POC web app for managing freelance/contract projects through a
configurable workflow and tracking monthly hours-based billing.

Data lives in the browser (localStorage) for now, behind a clean repository
interface so a sync backend can be added later without touching the UI.

## Features

- **Configurable workflow (kanban board).** Stages are data, not code. Add,
  rename, reorder, delete stages, and drag project cards between them. Mark any
  stage **billable** to include its projects in billing — the workflow can
  evolve without code changes.
- **Per-project hourly rate** and currency.
- **Monthly hours-based billing.** For each month you enter the hours worked;
  the invoice amount is `hours × rate`. The rate is snapshotted when hours are
  entered, so historical bills stay correct if the rate changes later.
- **Bill lifecycle:** pending → invoice sent → paid, with an automatic
  **overdue** flag (when a due date passes unpaid).
- **Missing-hours overview.** Lists billable projects that have no reported
  hours yet for the current (and optionally previous) month — handy when the
  numbers trickle in over a few days.
- **Revenue overview.** Billed / received / outstanding totals grouped by
  currency, with a per-project breakdown and time-range filters.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

On first run the app seeds a few sample projects and a default stage pipeline.
Use **Reset data** in the header to wipe and reseed.

## Architecture

```
src/
  domain/        # framework-free core
    types.ts       # entities: Stage, Project, MonthlyBill, Database
    actions.ts     # pure immutable mutations (return a new Database)
    selectors.ts   # derived data: amounts, overdue, missing hours, revenue
  data/          # persistence
    Repository.ts            # interface the app talks to
    LocalStorageRepository.ts# localStorage implementation
    seed.ts                  # default stages + sample data
    index.ts                 # chooses the active repository
  store/
    store.tsx      # React context: load/persist + bound actions
  components/      # Modal, ProjectForm, StageManager
  views/           # KanbanBoard, ProjectBilling, MissingHours, Revenue
```

### Designed for sync

The data model is built so a backend can be added later with minimal churn:

- Every entity has a stable `id` (UUID) plus `createdAt` / `updatedAt`
  timestamps — enough for a backend to diff and merge per record.
- The database is **normalized** (entities keyed by id), so records can sync
  independently instead of as one blob.
- A `schemaVersion` field plus a `migrate()` hook support future migrations.
- The app only talks to the `Repository` interface. To enable sync, implement
  that interface against a backend (REST, Supabase, …) and swap the instance in
  `src/data/index.ts`. No UI changes required.

## Notes

- Drag-and-drop uses the native HTML5 API (no extra dependencies).
- Derived values (invoice amount, overdue, missing hours) are never stored —
  they are computed from the raw data in `selectors.ts`.
