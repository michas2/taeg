import type { Database, Stage, Project, MonthlyBill } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { newId, now, currentMonthKey, prevMonth, addMonths } from "../utils/helpers";

/** Shape of a stage before id/timestamps are stamped on. */
type StageSeed = {
  name: string;
  order: number;
  color?: string;
  billable: boolean;
  terminal?: boolean;
};

/**
 * Default workflow stages, seeded from the user's described pipeline.
 * Fully editable in the UI afterwards. Only "active"/"leaving" are billable.
 */
const DEFAULT_STAGES: StageSeed[] = [
  { name: "Applied", order: 0, color: "#64748b", billable: false },
  { name: "Talked to recruiter", order: 1, color: "#0ea5e9", billable: false },
  { name: "Talked to customer", order: 2, color: "#6366f1", billable: false },
  { name: "Signed", order: 3, color: "#a855f7", billable: false },
  { name: "Active", order: 4, color: "#22c55e", billable: true },
  { name: "Leaving", order: 5, color: "#f59e0b", billable: true },
  { name: "Archived", order: 6, color: "#94a3b8", billable: false, terminal: true },
  { name: "Lost", order: 7, color: "#ef4444", billable: false, terminal: true },
];

function stamp<T extends object>(obj: T): T & { id: string; createdAt: string; updatedAt: string } {
  const ts = now();
  return { ...obj, id: newId(), createdAt: ts, updatedAt: ts };
}

/** Build a fresh database with default stages and a couple of sample projects. */
export function createSeedDatabase(): Database {
  const stages: Record<string, Stage> = {};
  for (const s of DEFAULT_STAGES) {
    const stage = stamp(s) as Stage;
    stages[stage.id] = stage;
  }

  const stageByName = (name: string) =>
    Object.values(stages).find((s) => s.name === name)!;

  const projects: Record<string, Project> = {};
  const bills: Record<string, MonthlyBill> = {};

  // Sample active project with a short billing history.
  const acme = stamp({
    name: "Acme Platform Rebuild",
    customer: "Acme Corp",
    recruiter: "TechStaff Agency",
    stageId: stageByName("Active").id,
    hourlyRate: 95,
    currency: "EUR",
    notes: "Backend modernization engagement.",
    boardOrder: 0,
  }) as Project;
  projects[acme.id] = acme;

  const globex = stamp({
    name: "Globex Mobile App",
    customer: "Globex",
    recruiter: "Globex",
    stageId: stageByName("Talked to customer").id,
    hourlyRate: 110,
    currency: "EUR",
    boardOrder: 0,
  }) as Project;
  projects[globex.id] = globex;

  // Bills for Acme: two prior months reported, current month still missing.
  const cur = currentMonthKey();
  const m1 = prevMonth(cur);
  const m2 = addMonths(cur, -2);

  const b2 = stamp({
    projectId: acme.id,
    month: m2,
    hours: 148,
    rateSnapshot: 95,
    status: "received",
    sentAt: now(),
    receivedAt: now(),
  }) as MonthlyBill;
  bills[b2.id] = b2;

  const b1 = stamp({
    projectId: acme.id,
    month: m1,
    hours: 160,
    rateSnapshot: 95,
    status: "sent",
    sentAt: now(),
  }) as MonthlyBill;
  bills[b1.id] = b1;

  // Current month deliberately left without hours to demo the "missing" view.
  const b0 = stamp({
    projectId: acme.id,
    month: cur,
    hours: null,
    rateSnapshot: null,
    status: "pending",
  }) as MonthlyBill;
  bills[b0.id] = b0;

  return {
    schemaVersion: SCHEMA_VERSION,
    stages,
    projects,
    bills,
  };
}
