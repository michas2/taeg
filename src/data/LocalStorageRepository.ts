import type { Database } from "../domain/types";
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
 * No migrations needed yet; this is the hook for future schema changes.
 */
function migrate(db: Database): Database {
  if (db.schemaVersion === SCHEMA_VERSION) return db;
  // Future: step through versions here.
  return { ...db, schemaVersion: SCHEMA_VERSION };
}
