import type {
  Database,
  MonthlyBill,
  Project,
  Stage,
  MonthKey,
} from "../domain/types";
import { currentMonthKey } from "../utils/helpers";

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
  return Object.values(db.bills)
    .filter((b) => b.projectId === projectId)
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)); // newest first
}

/** True if the project's current stage is flagged billable. */
export function isProjectBillable(db: Database, project: Project): boolean {
  return db.stages[project.stageId]?.billable ?? false;
}

export interface MissingEntry {
  project: Project;
  month: MonthKey;
  /** The bill record if one exists but has null hours; undefined if no bill yet. */
  bill?: MonthlyBill;
}

/**
 * Billable projects that are missing reported hours for the current month
 * (and optionally the previous month, since numbers can arrive late).
 * Returns entries where no bill exists OR a bill exists with null hours.
 */
export function missingHours(
  db: Database,
  months: MonthKey[] = [currentMonthKey()]
): MissingEntry[] {
  const out: MissingEntry[] = [];
  for (const project of Object.values(db.projects)) {
    if (!isProjectBillable(db, project)) continue;
    for (const month of months) {
      const bill = Object.values(db.bills).find(
        (b) => b.projectId === project.id && b.month === month
      );
      if (!bill || bill.hours == null) {
        out.push({ project, month, bill });
      }
    }
  }
  return out;
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
  return Object.values(db.projects)
    .map((project) => {
      let billed = 0;
      let received = 0;
      for (const bill of Object.values(db.bills)) {
        if (bill.projectId !== project.id) continue;
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
