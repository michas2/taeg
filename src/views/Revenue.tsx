import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { revenueByProject, revenueTotals } from "../domain/selectors";
import {
  formatMoney,
  currentMonthKey,
  addMonths,
  monthRange,
  monthLabel,
} from "../utils/helpers";
import "./Overview.css";

type RangeKey = "all" | "ytd" | "12m" | "month";

interface RevenueProps {
  onOpenProject: (projectId: string) => void;
}

export function Revenue({ onOpenProject }: RevenueProps) {
  const { db } = useStore();
  const [range, setRange] = useState<RangeKey>("all");

  const months = useMemo<string[] | undefined>(() => {
    const cur = currentMonthKey();
    switch (range) {
      case "all":
        return undefined;
      case "month":
        return [cur];
      case "12m":
        return monthRange(addMonths(cur, -11), cur);
      case "ytd": {
        const year = cur.slice(0, 4);
        return monthRange(`${year}-01`, cur);
      }
    }
  }, [range]);

  const perProject = useMemo(
    () => revenueByProject(db, months),
    [db, months]
  );
  const totals = useMemo(() => revenueTotals(db, months), [db, months]);
  const currencies = Object.keys(totals.byCurrency);

  return (
    <div className="overview">
      <div className="overview-head">
        <div>
          <h2>Revenue</h2>
          <p className="muted">
            Based on reported hours × rate. Received vs. still outstanding.
          </p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          style={{ width: "auto" }}
        >
          <option value="all">All time</option>
          <option value="ytd">Year to date</option>
          <option value="12m">Last 12 months</option>
          <option value="month">This month ({monthLabel(currentMonthKey())})</option>
        </select>
      </div>

      <div className="totals-grid">
        {currencies.length === 0 && (
          <div className="empty-state">No revenue in this period yet.</div>
        )}
        {currencies.map((cur) => {
          const t = totals.byCurrency[cur];
          return (
            <div className="totals-card" key={cur}>
              <div className="totals-card-head">{cur}</div>
              <div className="totals-metrics">
                <Metric label="Billed" value={formatMoney(t.billed, cur)} />
                <Metric
                  label="Received"
                  value={formatMoney(t.received, cur)}
                  tone="green"
                />
                <Metric
                  label="Outstanding"
                  value={formatMoney(t.outstanding, cur)}
                  tone={t.outstanding > 0 ? "amber" : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>

      {perProject.length > 0 && (
        <table className="revenue-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Billed</th>
              <th>Received</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {perProject.map((r) => (
              <tr
                key={r.project.id}
                className="clickable"
                onClick={() => onOpenProject(r.project.id)}
              >
                <td>
                  <div className="missing-name">{r.project.name}</div>
                  {r.project.client && (
                    <div className="muted">{r.project.client}</div>
                  )}
                </td>
                <td className="mono">{formatMoney(r.billed, r.currency)}</td>
                <td className="mono green">
                  {formatMoney(r.received, r.currency)}
                </td>
                <td className="mono">
                  {formatMoney(r.outstanding, r.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber";
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={"metric-value" + (tone ? " " + tone : "")}>{value}</div>
    </div>
  );
}
