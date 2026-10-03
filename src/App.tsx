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
import { SettingsMenu } from "./components/SettingsMenu";
import { KanbanBoard } from "./views/KanbanBoard";
import { ProjectBilling } from "./views/ProjectBilling";
import { Matrix } from "./views/Matrix";
import "./App.css";

type View =
  | { tab: "projects" }
  | { tab: "project"; projectId: string }
  | { tab: "timesheet" };

function Shell() {
  const { db, loading, reset, replace } = useStore();
  const [view, setView] = useState<View>({ tab: "projects" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All-time totals for the header (single currency).
  const totals = useMemo(() => revenueTotals(db), [db]);
  const hasRevenue = totals.billed > 0;

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
        setView({ tab: "projects" });
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

        {hasRevenue && (
          <div
            className="header-revenue"
            aria-label="Revenue summary"
            title={`Billed ${formatMoney(totals.billed)} · Received ${formatMoney(
              totals.received
            )} · Outstanding ${formatMoney(totals.outstanding)}`}
          >
            <div className="rev-group">
              <span className="rev-metric">
                <span className="rev-label">Received</span>
                <span className="rev-value green">
                  {formatMoney(totals.received)}
                </span>
              </span>
              <span className="rev-metric">
                <span className="rev-label">Outstanding</span>
                <span
                  className={
                    "rev-value" + (totals.outstanding > 0 ? " amber" : "")
                  }
                >
                  {formatMoney(totals.outstanding)}
                </span>
              </span>
            </div>
          </div>
        )}

        <nav className="tabs">
          <button
            className={view.tab === "projects" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "projects" })}
          >
            Projects
          </button>
          <button
            className={view.tab === "timesheet" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "timesheet" })}
          >
            Timesheet
          </button>
        </nav>

        <SettingsMenu>
          <button onClick={() => exportDatabase(db)}>Export backup…</button>
          <button onClick={() => fileInputRef.current?.click()}>
            Import backup…
          </button>
          <div className="settings-sep" />
          <button
            className="danger"
            onClick={() => {
              if (confirm("Reset all data back to the seed sample?"))
                void reset();
            }}
          >
            Reset data
          </button>
        </SettingsMenu>
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
      </header>

      <main className="app-main">
        {view.tab === "projects" && (
          <KanbanBoard
            onOpenProject={(projectId) => setView({ tab: "project", projectId })}
          />
        )}
        {view.tab === "project" && (
          <ProjectBilling
            projectId={view.projectId}
            onBack={() => setView({ tab: "projects" })}
          />
        )}
        {view.tab === "timesheet" && (
          <Matrix
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
