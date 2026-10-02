import type {
  Database,
  Stage,
  Project,
  MonthlyBill,
  BillStatus,
  MonthKey,
} from "../domain/types";
import { newId, now } from "../utils/helpers";

/**
 * Pure, immutable mutations on the Database. Each returns a new Database so
 * React state updates are predictable and a future sync layer can diff them.
 * Every change bumps the affected entity's `updatedAt`.
 */

function touch<T extends { updatedAt: string }>(entity: T): T {
  return { ...entity, updatedAt: now() };
}

// ---- Stages ----

export function addStage(
  db: Database,
  input: { name: string; billable?: boolean; color?: string; terminal?: boolean }
): Database {
  const ts = now();
  const maxOrder = Object.values(db.stages).reduce(
    (m, s) => Math.max(m, s.order),
    -1
  );
  const stage: Stage = {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    name: input.name,
    order: maxOrder + 1,
    color: input.color,
    billable: input.billable ?? false,
    terminal: input.terminal,
  };
  return { ...db, stages: { ...db.stages, [stage.id]: stage } };
}

export function updateStage(
  db: Database,
  id: string,
  patch: Partial<Omit<Stage, "id" | "createdAt">>
): Database {
  const existing = db.stages[id];
  if (!existing) return db;
  const updated = touch({ ...existing, ...patch });
  return { ...db, stages: { ...db.stages, [id]: updated } };
}

/** Remove a stage. Projects in it are moved to `fallbackStageId`. */
export function removeStage(
  db: Database,
  id: string,
  fallbackStageId?: string
): Database {
  if (!db.stages[id]) return db;
  const stages = { ...db.stages };
  delete stages[id];

  const projects = { ...db.projects };
  for (const p of Object.values(projects)) {
    if (p.stageId === id) {
      const target = fallbackStageId ?? Object.keys(stages)[0];
      if (!target) return db; // never remove the last stage
      projects[p.id] = touch({ ...p, stageId: target });
    }
  }
  return { ...db, stages, projects };
}

export function reorderStage(db: Database, id: string, newOrder: number): Database {
  const existing = db.stages[id];
  if (!existing) return db;
  return updateStage(db, id, { order: newOrder });
}

// ---- Projects ----

export function addProject(
  db: Database,
  input: {
    name: string;
    stageId: string;
    hourlyRate: number;
    currency: string;
    client?: string;
    notes?: string;
  }
): Database {
  const ts = now();
  const maxOrder = Object.values(db.projects)
    .filter((p) => p.stageId === input.stageId)
    .reduce((m, p) => Math.max(m, p.boardOrder), -1);
  const project: Project = {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    name: input.name,
    client: input.client,
    stageId: input.stageId,
    hourlyRate: input.hourlyRate,
    currency: input.currency,
    notes: input.notes,
    boardOrder: maxOrder + 1,
  };
  return { ...db, projects: { ...db.projects, [project.id]: project } };
}

export function updateProject(
  db: Database,
  id: string,
  patch: Partial<Omit<Project, "id" | "createdAt">>
): Database {
  const existing = db.projects[id];
  if (!existing) return db;
  const updated = touch({ ...existing, ...patch });
  return { ...db, projects: { ...db.projects, [id]: updated } };
}

export function moveProjectToStage(
  db: Database,
  projectId: string,
  stageId: string
): Database {
  const existing = db.projects[projectId];
  if (!existing || existing.stageId === stageId) return db;
  const maxOrder = Object.values(db.projects)
    .filter((p) => p.stageId === stageId)
    .reduce((m, p) => Math.max(m, p.boardOrder), -1);
  return updateProject(db, projectId, {
    stageId,
    boardOrder: maxOrder + 1,
  });
}

export function removeProject(db: Database, id: string): Database {
  if (!db.projects[id]) return db;
  const projects = { ...db.projects };
  delete projects[id];
  // Cascade: drop the project's bills too.
  const bills = { ...db.bills };
  for (const b of Object.values(bills)) {
    if (b.projectId === id) delete bills[b.id];
  }
  return { ...db, projects, bills };
}

// ---- Bills ----

/** Ensure a bill record exists for a project/month; returns existing or new. */
export function ensureBill(
  db: Database,
  projectId: string,
  month: MonthKey
): Database {
  const exists = Object.values(db.bills).some(
    (b) => b.projectId === projectId && b.month === month
  );
  if (exists) return db;
  const ts = now();
  const bill: MonthlyBill = {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    projectId,
    month,
    hours: null,
    rateSnapshot: null,
    status: "pending",
  };
  return { ...db, bills: { ...db.bills, [bill.id]: bill } };
}

/** Set hours for a bill (creating it if needed) and snapshot the rate. */
export function setBillHours(
  db: Database,
  projectId: string,
  month: MonthKey,
  hours: number | null
): Database {
  const project = db.projects[projectId];
  if (!project) return db;

  let bill = Object.values(db.bills).find(
    (b) => b.projectId === projectId && b.month === month
  );
  let next = db;
  if (!bill) {
    next = ensureBill(db, projectId, month);
    bill = Object.values(next.bills).find(
      (b) => b.projectId === projectId && b.month === month
    )!;
  }
  const updated = touch({
    ...bill,
    hours,
    // Snapshot the rate the moment hours are recorded.
    rateSnapshot: hours == null ? bill.rateSnapshot : project.hourlyRate,
  });
  return { ...next, bills: { ...next.bills, [updated.id]: updated } };
}

export function setBillStatus(
  db: Database,
  billId: string,
  status: BillStatus
): Database {
  const bill = db.bills[billId];
  if (!bill) return db;
  const ts = now();
  const updated = touch({
    ...bill,
    status,
    sentAt:
      status === "sent" || status === "received" ? bill.sentAt ?? ts : undefined,
    receivedAt: status === "received" ? bill.receivedAt ?? ts : undefined,
  });
  return { ...db, bills: { ...db.bills, [billId]: updated } };
}

export function updateBill(
  db: Database,
  id: string,
  patch: Partial<Omit<MonthlyBill, "id" | "createdAt">>
): Database {
  const existing = db.bills[id];
  if (!existing) return db;
  const updated = touch({ ...existing, ...patch });
  return { ...db, bills: { ...db.bills, [id]: updated } };
}
