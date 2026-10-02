import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { missingHours } from "../domain/selectors";
import {
  currentMonthKey,
  prevMonth,
  monthLabel,
} from "../utils/helpers";
import "./Overview.css";

interface MissingHoursProps {
  onOpenProject: (projectId: string) => void;
}

/**
 * Shows billable projects that still have no reported hours for recent months.
 * Defaults to the current + previous month, since numbers often arrive late.
 */
export function MissingHours({ onOpenProject }: MissingHoursProps) {
  const { db } = useStore();
  const [includePrev, setIncludePrev] = useState(true);

  const months = useMemo(() => {
    const cur = currentMonthKey();
    return includePrev ? [prevMonth(cur), cur] : [cur];
  }, [includePrev]);

  const entries = useMemo(() => missingHours(db, months), [db, months]);

  // Group by month for readability.
  const byMonth = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = map.get(e.month) ?? [];
      list.push(e);
      map.set(e.month, list);
    }
    // Newest month first.
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  return (
    <div className="overview">
      <div className="overview-head">
        <div>
          <h2>Missing hours</h2>
          <p className="muted">
            Billable projects without reported hours yet.
          </p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={includePrev}
            onChange={(e) => setIncludePrev(e.target.checked)}
            style={{ width: "auto" }}
          />
          include previous month
        </label>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          🎉 All billable projects have reported hours for{" "}
          {months.map(monthLabel).join(" and ")}.
        </div>
      ) : (
        byMonth.map(([month, list]) => (
          <section key={month} className="month-group">
            <h3 className="month-group-title">
              {monthLabel(month)}
              <span className="badge amber">{list.length} missing</span>
            </h3>
            <div className="missing-list">
              {list.map((entry) => (
                <div className="missing-row" key={entry.project.id + month}>
                  <div>
                    <div className="missing-name">{entry.project.name}</div>
                    {(entry.project.customer || entry.project.recruiter) && (
                      <div className="muted">
                        {entry.project.customer ?? entry.project.recruiter}
                        {entry.project.recruiter &&
                          entry.project.recruiter !== entry.project.customer &&
                          ` · invoice to ${entry.project.recruiter}`}
                      </div>
                    )}
                  </div>
                  <button
                    className="primary"
                    onClick={() => onOpenProject(entry.project.id)}
                  >
                    Enter hours
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
