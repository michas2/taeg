import { useState } from "react";
import { StoreProvider, useStore } from "./store/store";
import { KanbanBoard } from "./views/KanbanBoard";
import { ProjectBilling } from "./views/ProjectBilling";
import { MissingHours } from "./views/MissingHours";
import { Revenue } from "./views/Revenue";
import "./App.css";

type View =
  | { tab: "board" }
  | { tab: "project"; projectId: string }
  | { tab: "missing" }
  | { tab: "revenue" };

function Shell() {
  const { loading, reset } = useStore();
  const [view, setView] = useState<View>({ tab: "board" });

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
        <nav className="tabs">
          <button
            className={view.tab === "board" ? "tab active" : "tab"}
            onClick={() => setView({ tab: "board" })}
          >
            Board
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
