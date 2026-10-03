import type {
  Database,
  MonthlyBill,
  Project,
  Stage,
  MonthKey,
} from "../domain/types";

/**
 * Index of bills for O(1) lookups, avoiding repeated full scans of db.bills.
 * - `byProjectMonth`: key `${projectId}:${month}` → bill
 * - `byProject`: projectId → bills[]
 *
 * Build once per derivation (selectors that take a Database build it
 * internally; views that need several lookups can build it once and reuse).
 */
export interface BillIndex {
  byProjectMonth: Map<string, MonthlyBill>;
  byProject: Map<string, MonthlyBill[]>;
}

export function buildBillIndex(db: Database): BillIndex {
  const byProjectMonth = new Map<string, MonthlyBill>();
  const byProject = new Map<string, MonthlyBill[]>();
  for (const bill of Object.values(db.bills)) {
    byProjectMonth.set(`${bill.projectId}:${bill.month}`, bill);
    const list = byProject.get(bill.projectId);
    if (list) list.push(bill);
    else byProject.set(bill.projectId, [bill]);
  }
  return { byProjectMonth, byProject };
}

/** Effective rate for a bill: snapshot if present, else the project's rate. */
export function billRate(bill: MonthlyBill, project: Project): number {
  return bill.rateSnapshot ?? project.hourlyRate;
}

/** Invoice amount for a bill, or 0 if hours not yet reported. */
export function billAmount(bill: MonthlyBill, project: Project): number {
  if (bill.hours == null) return 0;
  return bill.hours * billRate(bill, project);
}

/**
 * A bill is overdue when it has a due date in the past and payment has not
 * been received. Derived, never stored.
 */
export function isOverdue(bill: MonthlyBill, asOf: Date = new Date()): boolean {
  if (bill.status === "received") return false;
  if (!bill.dueDate) return false;
  return new Date(bill.dueDate).getTime() < asOf.getTime();
}

export function stagesSorted(db: Database): Stage[] {
  return Object.values(db.stages).sort((a, b) => a.order - b.order);
}

export function projectsInStage(db: Database, stageId: string): Project[] {
  return Object.values(db.projects)
    .filter((p) => p.stageId === stageId)
    .sort((a, b) => a.boardOrder - b.boardOrder);
}

export function billsForProject(db: Database, projectId: string): MonthlyBill[] {
  const bills = buildBillIndex(db).byProject.get(projectId) ?? [];
  // newest first
  return [...bills].sort((a, b) =>
    a.month < b.month ? 1 : a.month > b.month ? -1 : 0
  );
}

/** True if the project's current stage is flagged billable. */
export function isProjectBillable(db: Database, project: Project): boolean {
  return db.stages[project.stageId]?.billable ?? false;
}

export interface ProjectRevenue {
  project: Project;
  /** Billed = hours reported (any status). */
  billed: number;
  /** Received = status === "received". */
  received: number;
  /** Outstanding = reported but not yet received. */
  outstanding: number;
  currency: string;
}

/** Revenue aggregated per project, optionally restricted to a set of months. */
export function revenueByProject(
  db: Database,
  months?: MonthKey[]
): ProjectRevenue[] {
  const monthSet = months ? new Set(months) : null;
  const { byProject } = buildBillIndex(db);
  return Object.values(db.projects)
    .map((project) => {
      let billed = 0;
      let received = 0;
      for (const bill of byProject.get(project.id) ?? []) {
        if (monthSet && !monthSet.has(bill.month)) continue;
        const amount = billAmount(bill, project);
        if (amount === 0) continue;
        billed += amount;
        if (bill.status === "received") received += amount;
      }
      return {
        project,
        billed,
        received,
        outstanding: billed - received,
        currency: project.currency,
      };
    })
    .filter((r) => r.billed > 0)
    .sort((a, b) => b.billed - a.billed);
}

export interface RevenueTotals {
  byCurrency: Record<string, { billed: number; received: number; outstanding: number }>;
}

/** Totals across all projects, grouped by currency (rates can differ). */
export function revenueTotals(db: Database, months?: MonthKey[]): RevenueTotals {
  const byCurrency: RevenueTotals["byCurrency"] = {};
  for (const r of revenueByProject(db, months)) {
    const bucket = (byCurrency[r.currency] ??= {
      billed: 0,
      received: 0,
      outstanding: 0,
    });
    bucket.billed += r.billed;
    bucket.received += r.received;
    bucket.outstanding += r.outstanding;
  }
  return { byCurrency };
}


// ---- Matrix aggregations (month × project) ----

export interface HoursRevenue {
  hours: number;
  revenue: number;
}

/**
 * Per-project totals (hours + revenue) across a set of months. Keyed by
 * project id. Each project is single-currency, so revenue is a plain number.
 */
export function projectTotals(
  projects: Project[],
  months: MonthKey[],
  index: BillIndex
): Record<string, HoursRevenue> {
  const totals: Record<string, HoursRevenue> = {};
  for (const p of projects) {
    let hours = 0;
    let revenue = 0;
    for (const m of months) {
      const bill = index.byProjectMonth.get(`${p.id}:${m}`);
      if (bill?.hours != null) {
        hours += bill.hours;
        revenue += billAmount(bill, p);
      }
    }
    totals[p.id] = { hours, revenue };
  }
  return totals;
}

export interface MonthTotal {
  hours: number;
  /** Revenue grouped by currency (projects may bill in different ones). */
  revenueByCurrency: Record<string, number>;
}

/** Per-month totals (hours + revenue by currency) across the given projects. */
export function monthTotals(
  projects: Project[],
  months: MonthKey[],
  index: BillIndex
): Record<string, MonthTotal> {
  const byMonth: Record<string, MonthTotal> = {};
  for (const m of months) {
    let hours = 0;
    const revenueByCurrency: Record<string, number> = {};
    for (const p of projects) {
      const bill = index.byProjectMonth.get(`${p.id}:${m}`);
      if (bill?.hours != null) {
        hours += bill.hours;
        revenueByCurrency[p.currency] =
          (revenueByCurrency[p.currency] ?? 0) + billAmount(bill, p);
      }
    }
    byMonth[m] = { hours, revenueByCurrency };
  }
  return byMonth;
}

/** Grand total (hours + revenue by currency) across all given month totals. */
export function grandTotal(byMonth: Record<string, MonthTotal>): MonthTotal {
  let hours = 0;
  const revenueByCurrency: Record<string, number> = {};
  for (const mt of Object.values(byMonth)) {
    hours += mt.hours;
    for (const [cur, amt] of Object.entries(mt.revenueByCurrency)) {
      revenueByCurrency[cur] = (revenueByCurrency[cur] ?? 0) + amt;
    }
  }
  return { hours, revenueByCurrency };
}
