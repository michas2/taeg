import { useMemo, useState } from "react";
import { StoreProvider, useStore } from "./store/store";
import { revenueTotals } from "./domain/selectors";
import { formatMoney } from "./utils/helpers";
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
  const { db, loading, reset } = useStore();
  const [view, setView] = useState<View>({ tab: "board" });

  // All-time totals for the header, grouped by currency (rates can differ).
  const totals = useMemo(() => revenueTotals(db), [db]);
  const currencies = Object.keys(totals.byCurrency);

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
        <button
          className="ghost"
          onClick={() => {
            if (confirm("Reset all data back to the seed sample?")) void reset();
          }}
        >
          Reset data
        </button>
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
