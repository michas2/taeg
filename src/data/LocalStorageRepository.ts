import type { Database, Project } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import type { Repository } from "./Repository";

const STORAGE_KEY = "taeg.db.v1";

/**
 * localStorage-backed Repository. Async signatures (Promise) match the
 * interface so a network-backed implementation is a drop-in replacement.
 */
export class LocalStorageRepository implements Repository {
  private readonly key: string;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
  }

  async load(): Promise<Database | null> {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Database;
      return migrate(parsed);
    } catch (err) {
      console.error("Failed to parse stored database:", err);
      return null;
    }
  }

  async save(db: Database): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(db));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}

/**
 * Forward-migrate a loaded database to the current schema version.
 * Each step upgrades one version so older stored data keeps working.
 * Exported so restored backups go through the same upgrade path.
 */
export function migrate(db: Database): Database {
  let current = db;

  // v1 -> v2: the single `client` field was split into `customer` + `recruiter`.
  // Carry the old value over to `customer` (who the work was done for).
  if ((current.schemaVersion ?? 1) < 2) {
    const projects: Database["projects"] = {};
    for (const [id, p] of Object.entries(current.projects)) {
      const legacy = p as Project & { client?: string };
      const { client, ...rest } = legacy;
      projects[id] = {
        ...rest,
        customer: rest.customer ?? client,
      };
    }
    current = { ...current, projects, schemaVersion: 2 };
  }

  return { ...current, schemaVersion: SCHEMA_VERSION };
}
