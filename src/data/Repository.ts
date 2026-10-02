import type { Database } from "../domain/types";

/**
 * Persistence contract for the whole database.
 *
 * The app only talks to this interface, never to localStorage directly.
 * To add real sync later, implement this against a backend (REST, Supabase,
 * etc.) and swap the instance in `src/data/index.ts` — no UI changes needed.
 *
 * Kept blob-oriented (load/save the whole Database) for POC simplicity. The
 * normalized shape means a record-level backend can still diff efficiently.
 */
export interface Repository {
  /** Load the database, or null if nothing stored yet. */
  load(): Promise<Database | null>;
  /** Persist the full database. */
  save(db: Database): Promise<void>;
  /** Remove all stored data (used for reset). */
  clear(): Promise<void>;
}
