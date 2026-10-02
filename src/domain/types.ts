/**
 * Core domain model.
 *
 * Design notes for future sync:
 * - Every entity has a stable string `id` (UUID), plus `createdAt` / `updatedAt`
 *   ISO timestamps. This lets a backend diff and merge per-record later.
 * - The database is normalized (entities keyed by id) so individual records can
 *   be synced independently without rewriting the whole blob.
 * - `schemaVersion` enables future migrations.
 */

export type Id = string;

/** ISO-8601 timestamp, e.g. "2026-10-02T19:30:00.000Z". */
export type IsoTimestamp = string;

/** Year-month key used for billing periods, e.g. "2026-10". */
export type MonthKey = string;

/** Fields shared by every stored entity. */
export interface Entity {
  id: Id;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/**
 * A workflow stage (a kanban column). Stages are data, not code, so the
 * workflow can evolve: add/rename/reorder/remove without a code change.
 */
export interface Stage extends Entity {
  name: string;
  /** Ordering within the board; lower = further left. */
  order: number;
  /** Optional accent color for the column header. */
  color?: string;
  /**
   * Projects in a stage flagged `billable` get monthly bills generated.
   * This decouples billing from any specific stage name (flexible for a POC).
   */
  billable: boolean;
  /** Terminal stages (archived/lost) can be visually de-emphasized. */
  terminal?: boolean;
}

/** A client project / engagement. */
export interface Project extends Entity {
  name: string;
  /** The company you actually work for / do the work at. */
  customer?: string;
  /** The agency/intermediary you send the invoice to (may equal the customer). */
  recruiter?: string;
  stageId: Id;
  /** Per-project hourly rate. */
  hourlyRate: number;
  /** ISO-4217 currency code, e.g. "EUR". */
  currency: string;
  notes?: string;
  /** Manual position within a stage column for stable ordering. */
  boardOrder: number;
}

/** Lifecycle of a monthly bill. "overdue" is derived, not stored. */
export type BillStatus = "pending" | "sent" | "received";

/**
 * One month of billing for one project.
 * `hours` is null until the numbers come in (drives the "missing" overview).
 */
export interface MonthlyBill extends Entity {
  projectId: Id;
  /** Billing period, e.g. "2026-09". */
  month: MonthKey;
  /** Hours worked that month; null = not yet reported. */
  hours: number | null;
  /**
   * Rate snapshot at the time hours were entered, so historical bills stay
   * correct even if the project's rate changes later. Falls back to the
   * project's current rate when null.
   */
  rateSnapshot: number | null;
  status: BillStatus;
  /** When the invoice was marked sent. */
  sentAt?: IsoTimestamp;
  /** When payment was recorded. */
  receivedAt?: IsoTimestamp;
  /** Optional due date; used to derive "overdue". */
  dueDate?: IsoTimestamp;
  notes?: string;
}

/** The full normalized database persisted to storage. */
export interface Database {
  schemaVersion: number;
  stages: Record<Id, Stage>;
  projects: Record<Id, Project>;
  bills: Record<Id, MonthlyBill>;
}

export const SCHEMA_VERSION = 2;
