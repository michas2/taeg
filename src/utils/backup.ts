import type { Database } from "../domain/types";
import { migrate } from "../data/LocalStorageRepository";

/**
 * Backup / restore of the whole database as a JSON file.
 *
 * Export writes a pretty-printed snapshot the user can save anywhere.
 * Import parses + validates the file, then runs it through the same
 * `migrate()` path as normal loads so older backups upgrade cleanly.
 */

/** Trigger a download of the current database as a timestamped JSON file. */
export function exportDatabase(db: Database): void {
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const a = document.createElement("a");
  a.href = url;
  a.download = `taeg-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Thrown when an imported file isn't a valid backup. */
export class InvalidBackupError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse and validate a backup string into a migrated Database.
 * Throws InvalidBackupError with a human-readable message on bad input.
 */
export function parseBackup(text: string): Database {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidBackupError("The file is not valid JSON.");
  }

  if (!isRecord(data)) {
    throw new InvalidBackupError("The backup must be a JSON object.");
  }

  if (typeof data.schemaVersion !== "number") {
    throw new InvalidBackupError("Missing or invalid 'schemaVersion'.");
  }

  for (const key of ["stages", "projects", "bills"] as const) {
    if (!isRecord(data[key])) {
      throw new InvalidBackupError(`Missing or invalid '${key}' collection.`);
    }
  }

  // Shape looks right; upgrade to the current schema version.
  return migrate(data as unknown as Database);
}

/** Read a File (from an <input type="file">) as text. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsText(file);
  });
}
