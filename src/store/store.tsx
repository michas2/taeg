import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Database } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { repository } from "../data";
import { createSeedDatabase } from "../data/seed";
import * as actions from "../domain/actions";

type Updater = (db: Database) => Database;

interface StoreContextValue {
  db: Database;
  loading: boolean;
  /** Apply a pure updater; state + persistence happen automatically. */
  apply: (updater: Updater) => void;
  /** Replace the entire database (e.g. restoring a backup). */
  replace: (db: Database) => Promise<void>;
  /** Wipe storage and reseed. */
  reset: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load (or seed on first run).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await repository.load();
      if (cancelled) return;
      if (loaded) {
        setDb(loaded);
      } else {
        const seeded = createSeedDatabase();
        await repository.save(seeded);
        setDb(seeded);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence whenever db changes.
  useEffect(() => {
    if (!db) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void repository.save(db);
    }, 150);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [db]);

  const apply = useCallback((updater: Updater) => {
    setDb((prev) => (prev ? updater(prev) : prev));
  }, []);

  const reset = useCallback(async () => {
    await repository.clear();
    const seeded = createSeedDatabase();
    await repository.save(seeded);
    setDb(seeded);
  }, []);

  const replace = useCallback(async (next: Database) => {
    await repository.save(next);
    setDb(next);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      db: db ?? EMPTY_DB,
      loading,
      apply,
      replace,
      reset,
    }),
    [db, loading, apply, replace, reset]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

const EMPTY_DB: Database = {
  schemaVersion: SCHEMA_VERSION,
  stages: {},
  projects: {},
  bills: {},
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** Bound action creators that apply directly to the store. */
export function useActions() {
  const { apply } = useStore();
  return useMemo(
    () => ({
      addStage: (input: Parameters<typeof actions.addStage>[1]) =>
        apply((db) => actions.addStage(db, input)),
      updateStage: (id: string, patch: Parameters<typeof actions.updateStage>[2]) =>
        apply((db) => actions.updateStage(db, id, patch)),
      removeStage: (id: string, fallback?: string) =>
        apply((db) => actions.removeStage(db, id, fallback)),
      reorderStage: (id: string, order: number) =>
        apply((db) => actions.reorderStage(db, id, order)),

      addProject: (input: Parameters<typeof actions.addProject>[1]) =>
        apply((db) => actions.addProject(db, input)),
      updateProject: (id: string, patch: Parameters<typeof actions.updateProject>[2]) =>
        apply((db) => actions.updateProject(db, id, patch)),
      moveProjectToStage: (projectId: string, stageId: string) =>
        apply((db) => actions.moveProjectToStage(db, projectId, stageId)),
      removeProject: (id: string) =>
        apply((db) => actions.removeProject(db, id)),

      ensureBill: (projectId: string, month: string) =>
        apply((db) => actions.ensureBill(db, projectId, month)),
      setBillHours: (projectId: string, month: string, hours: number | null) =>
        apply((db) => actions.setBillHours(db, projectId, month, hours)),
      setBillStatus: (billId: string, status: Parameters<typeof actions.setBillStatus>[2]) =>
        apply((db) => actions.setBillStatus(db, billId, status)),
      updateBill: (id: string, patch: Parameters<typeof actions.updateBill>[2]) =>
        apply((db) => actions.updateBill(db, id, patch)),
    }),
    [apply]
  );
}
