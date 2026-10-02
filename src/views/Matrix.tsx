import { useMemo, useState } from "react";
import { useStore, useActions } from "../store/store";
import { isProjectBillable, billAmount } from "../domain/selectors";
import type { Database, MonthlyBill, Project } from "../domain/types";
import {
  currentMonthKey,
  addMonths,
  monthRange,
  monthLabel,
  formatMoney,
} from "../utils/helpers";
import "./Matrix.css";

interface MatrixProps {
  onOpenProject: (projectId: string) => void;
}

/** Fast index of bills keyed by `${projectId}:${month}`. */
function billIndex(db: Database): Map<string, MonthlyBill> {
  const map = new Map<string, MonthlyBill>();
  for (const b of Object.values(db.bills)) {
    map.set(`${b.projectId}:${b.month}`, b);
  }
  return map;
}

export function Matrix({ onOpenProject }: MatrixProps) {
  const { db } = useStore();
  const actions = useActions();
  const [monthsBack, setMonthsBack] = useState(6);
  const [onlyBillable, setOnlyBillable] = useState(true);

  // Columns: projects (billable first), optionally filtered to billable only.
  const projects = useMemo(() => {
    const all = Object.values(db.projects);
    const filtered = onlyBillable
      ? all.filter((p) => isProjectBillable(db, p))
      : all;
    return filtered.sort((a, b) => {
      const ab = isProjectBillable(db, a) ? 0 : 1;
      const bb = isProjectBillable(db, b) ? 0 : 1;
      if (ab !== bb) return ab - bb;
      return a.name.localeCompare(b.name);
    });
  }, [db, onlyBillable]);

  // Rows: months, newest first.
  const months = useMemo(() => {
    const cur = currentMonthKey();
    return monthRange(addMonths(cur, -(monthsBack - 1)), cur).reverse();
  }, [monthsBack]);

  const index = useMemo(() => billIndex(db), [db]);

  // Column (per-project) hours totals across the shown months.
  const projectTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of projects) {
      let sum = 0;
      for (const m of months) {
        const bill = index.get(`${p.id}:${m}`);
        if (bill?.hours != null) sum += bill.hours;
      }
      totals[p.id] = sum;
    }
    return totals;
  }, [projects, months, index]);

  if (projects.length === 0) {
    return (
      <div className="matrix-wrap">
        <div className="empty-state">
          No {onlyBillable ? "billable " : ""}projects to show.
          {onlyBillable && (
            <>
              {" "}
              <button className="ghost" onClick={() => setOnlyBillable(false)}>
                Show all projects
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="matrix-wrap">
      <div className="matrix-toolbar">
        <div className="matrix-legend">
          <span className="legend-item">
            <span className="legend-swatch sw-estimated" /> estimated
          </span>
          <span className="legend-item">
            <span className="legend-swatch sw-invoiced" /> invoiced
          </span>
          <span className="legend-item">
            <span className="legend-swatch sw-paid" /> paid
          </span>
          <span className="legend-item">
            <span className="legend-swatch sw-missing" /> missing
          </span>
        </div>
        <div className="matrix-controls">
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyBillable}
              onChange={(e) => setOnlyBillable(e.target.checked)}
              style={{ width: "auto" }}
            />
            billable only
          </label>
          <label className="toggle">
            months
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(Number(e.target.value))}
              style={{ width: "auto" }}
            >
              {[3, 6, 12, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner">Month</th>
              {projects.map((p) => (
                <th key={p.id} className="col-head">
                  <button
                    className="col-head-btn"
                    onClick={() => onOpenProject(p.id)}
                    title={p.customer ?? p.recruiter ?? p.name}
                  >
                    {p.name}
                  </button>
                  <div className="muted col-sub">
                    {formatMoney(p.hourlyRate, p.currency)}/h
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month}>
                <th className="row-head">
                  <div>{monthLabel(month)}</div>
                  <div className="muted mono">{month}</div>
                </th>
                {projects.map((p) => (
                  <MatrixCell
                    key={p.id}
                    project={p}
                    bill={index.get(`${p.id}:${month}`)}
                    billable={isProjectBillable(db, p)}
                    onCommit={(hours) =>
                      actions.setBillHours(p.id, month, hours)
                    }
                  />
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="row-head">Total hours</th>
              {projects.map((p) => (
                <td key={p.id} className="total-cell mono">
                  {projectTotals[p.id] || 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MatrixCell({
  project,
  bill,
  billable,
  onCommit,
}: {
  project: Project;
  bill?: MonthlyBill;
  billable: boolean;
  onCommit: (hours: number | null) => void;
}) {
  const stored = bill?.hours ?? null;
  const [draft, setDraft] = useState(stored == null ? "" : String(stored));

  // Keep the input in sync if the underlying value changes elsewhere.
  const storedKey = stored == null ? "" : String(stored);
  const [lastStored, setLastStored] = useState(storedKey);
  if (storedKey !== lastStored) {
    setLastStored(storedKey);
    setDraft(storedKey);
  }

  function commit() {
    const t = draft.trim();
    const next = t === "" ? null : Number(t);
    const cur = stored;
    if (next === cur) return;
    if (next != null && Number.isNaN(next)) {
      setDraft(storedKey);
      return;
    }
    onCommit(next);
  }

  const missing = billable && stored == null;
  const amount = bill ? billAmount(bill, project) : 0;

  // Color-code by billing state once hours are present.
  //   estimated = hours entered, not yet invoiced (pending)
  //   invoiced  = invoice sent, not yet paid       (sent)
  //   paid      = payment received                 (received)
  let stateClass = "";
  if (missing) {
    stateClass = " cell-missing";
  } else if (stored != null && bill) {
    stateClass =
      bill.status === "received"
        ? " cell-paid"
        : bill.status === "sent"
          ? " cell-invoiced"
          : " cell-estimated";
  }

  return (
    <td className={"cell" + stateClass}>
      <input
        className="cell-input mono"
        type="number"
        min="0"
        step="0.5"
        inputMode="decimal"
        placeholder={billable ? "—" : ""}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {stored != null && amount > 0 && (
        <div className="cell-amount muted">
          {formatMoney(amount, project.currency)}
        </div>
      )}
    </td>
  );
}
