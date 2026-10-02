import { useMemo, useRef, useState } from "react";
import { StoreProvider, useStore } from "./store/store";
import { revenueTotals } from "./domain/selectors";
import { formatMoney } from "./utils/helpers";
import {
  exportDatabase,
  parseBackup,
  readFileText,
  InvalidBackupError,
} from "./utils/backup";
import { KanbanBoard } from "./views/KanbanBoard";
import { ProjectBilling } from "./views/ProjectBilling";
import { MissingHours } from "./views/MissingHours";
import { Revenue } from "./views/Revenue";
import { Matrix } from "./views/Matrix";
import "./App.css";

type View =
  | { tab: "board" }
  | { tab: "project"; projectId: string }
  | { tab: "matrix" }
  | { tab: "missing" }
  | { tab: "revenue" };

function Shell() {
  const { db, loading, reset, replace } = useStore();
  const [view, setView] = useState<View>({ tab: "board" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All-time totals for the header, grouped by currency (rates can differ).
  const totals = useMemo(() => revenueTotals(db), [db]);
  const currencies = Object.keys(totals.byCurrency);

  async function handleImportFile(file: File) {
    try {
      const text = await readFileText(file);
      const restored = parseBackup(text);
      const counts = `${Object.keys(restored.projects).length} projects, ${
        Object.keys(restored.bills).length
      } bills`;
      if (
        confirm(
          `Restore this backup (${counts})?\n\nThis replaces all current data.`
        )
      ) {
        await replace(restored);
        setView({ tab: "board" });
      }
    } catch (err) {
      const msg =
        err instanceof InvalidBackupError
          ? err.message
          : "Could not read the file.";
      alert(`Import failed: ${msg}`);
    }
  }

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◧</span>
          <strong>taeg</strong>
          <span className="muted">project &amp; billing manager</span>
        </div>

        {currencies.length > 0 && (
          <div className="header-revenue" aria-label="Revenue summary">
            {currencies.map((cur) => {
              const t = totals.byCurrency[cur];
              return (
                <div
                  key={cur}
                  className="rev-group"
                  title={`Billed ${formatMoney(t.billed, cur)} · Received ${formatMoney(
                    t.received,
                    cur
                  )} · Outstanding ${formatMoney(t.outstanding, cur)}`}
                >
                  <span className="rev-metric">
                    <span className="rev-label">Received</span>
                    <span className="rev-value green">
                      {formatMoney(t.received, cur)}
                    </span>
                  </span>
                  <span className="rev-metric">
                    <span className="rev-label">Outstanding</span>
                    <span
                      className={
                        "rev-value" + (t.outstanding > 0 ? " amber" : "")
                      }
                    >
                      {formatMoney(t.outstanding, cur)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <nav className="tabs">
          <button
            className={view.tab === "board" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "board" })}
          >
            Board
          </button>
          <button
            className={view.tab === "matrix" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "matrix" })}
          >
            Hours matrix
          </button>
          <button
            className={view.tab === "missing" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "missing" })}
          >
            Missing hours
          </button>
          <button
            className={view.tab === "revenue" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "revenue" })}
          >
            Revenue
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="ghost"
            title="Download a JSON backup of all data"
            onClick={() => exportDatabase(db)}
          >
            Export
          </button>
          <button
            className="ghost"
            title="Restore data from a JSON backup"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              // Reset so selecting the same file again re-triggers change.
              e.target.value = "";
            }}
          />
          <button
            className="ghost"
            onClick={() => {
              if (confirm("Reset all data back to the seed sample?"))
                void reset();
            }}
          >
            Reset data
          </button>
        </div>
      </header>

      <main className="app-main">
        {view.tab === "board" && (
          <KanbanBoard
            onOpenProject={(projectId) => setView({ tab: "project", projectId })}
          />
        )}
        {view.tab === "project" && (
          <ProjectBilling
            projectId={view.projectId}
            onBack={() => setView({ tab: "board" })}
          />
        )}
        {view.tab === "matrix" && (
          <Matrix
            onOpenProject={(projectId) => setView({ tab: "project", projectId })}
          />
        )}
        {view.tab === "missing" && (
          <MissingHours
            onOpenProject={(projectId) => setView({ tab: "project", projectId })}
          />
        )}
        {view.tab === "revenue" && (
          <Revenue
            onOpenProject={(projectId) => setView({ tab: "project", projectId })}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
