import { useMemo, useState } from "react";
import { useStore, useActions } from "../store/store";
import { useHoursInput } from "../components/useHoursInput";
import {
  isProjectBillable,
  billAmount,
  buildBillIndex,
  projectTotals as computeProjectTotals,
  monthTotals as computeMonthTotals,
  grandTotal as computeGrandTotal,
} from "../domain/selectors";
import type { MonthlyBill, Project, BillStatus } from "../domain/types";
import {
  currentMonthKey,
  addMonths,
  monthRange,
  monthLabel,
  formatMoney,
  businessDays,
  businessHours,
  HOURS_PER_DAY,
} from "../utils/helpers";
import "./Matrix.css";

interface MatrixProps {
  onOpenProject: (projectId: string) => void;
}

/**
 * Format a revenue-by-currency map into one or more amount strings.
 * Returns "—" when there is nothing. Multiple currencies are shown on
 * separate lines (projects may bill in different currencies).
 */
function formatRevenueByCurrency(
  byCurrency: Record<string, number>
): string[] {
  const entries = Object.entries(byCurrency).filter(([, amt]) => amt !== 0);
  if (entries.length === 0) return ["—"];
  return entries.map(([cur, amt]) => formatMoney(amt, cur));
}

export function Matrix({ onOpenProject }: MatrixProps) {
  const { db } = useStore();
  const actions = useActions();
  const [monthsBack, setMonthsBack] = useState(12);
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

  const index = useMemo(() => buildBillIndex(db), [db]);

  // Column (per-project) totals across the shown months: hours + revenue.
  const projectTotals = useMemo(
    () => computeProjectTotals(projects, months, index),
    [projects, months, index]
  );

  // Row (per-month) totals across all shown projects, grouped by currency.
  const monthTotals = useMemo(
    () => computeMonthTotals(projects, months, index),
    [projects, months, index]
  );

  // Grand total across all shown months and projects.
  const grandTotal = useMemo(
    () => computeGrandTotal(monthTotals),
    [monthTotals]
  );

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
              <th className="col-head col-total-head">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month}>
                <th className="row-head">
                  <div>{monthLabel(month)}</div>
                  <div className="muted mono">{month}</div>
                  <div className="row-workdays" title="Working days (Mon–Fri) and hours at 8h/day">
                    {businessDays(month)} d · {businessHours(month)} h
                  </div>
                </th>
                {projects.map((p) => (
                  <MatrixCell
                    key={p.id}
                    project={p}
                    bill={index.byProjectMonth.get(`${p.id}:${month}`)}
                    billable={isProjectBillable(db, p)}
                    workDays={businessDays(month)}
                    onCommit={(hours) =>
                      actions.setBillHours(p.id, month, hours)
                    }
                    onStatus={(billId, status) =>
                      actions.setBillStatus(billId, status)
                    }
                  />
                ))}
                <td className="total-cell month-total mono">
                  <div className="total-hours">
                    {monthTotals[month]?.hours || 0} h
                  </div>
                  {formatRevenueByCurrency(
                    monthTotals[month]?.revenueByCurrency ?? {}
                  ).map((line, i) => (
                    <div className="total-revenue" key={i}>
                      {line}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="row-head">Total</th>
              {projects.map((p) => (
                <td key={p.id} className="total-cell mono">
                  <div className="total-hours">
                    {projectTotals[p.id]?.hours || 0} h
                  </div>
                  <div className="total-revenue">
                    {formatMoney(projectTotals[p.id]?.revenue || 0, p.currency)}
                  </div>
                </td>
              ))}
              <td className="total-cell month-total grand-total mono">
                <div className="total-hours">{grandTotal.hours || 0} h</div>
                {formatRevenueByCurrency(grandTotal.revenueByCurrency).map(
                  (line, i) => (
                    <div className="total-revenue" key={i}>
                      {line}
                    </div>
                  )
                )}
              </td>
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
  workDays,
  onCommit,
  onStatus,
}: {
  project: Project;
  bill?: MonthlyBill;
  billable: boolean;
  workDays: number;
  onCommit: (hours: number | null) => void;
  onStatus: (billId: string, status: BillStatus) => void;
}) {
  const stored = bill?.hours ?? null;
  const hoursInput = useHoursInput(stored, onCommit);

  const missing = billable && stored == null;
  const amount = bill ? billAmount(bill, project) : 0;

  // Days not yet booked = the month's working days minus booked days
  // (booked days = hours / HOURS_PER_DAY). Rounded to one decimal.
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const bookedDays = stored == null ? 0 : stored / HOURS_PER_DAY;
  const unbookedDays = round1(workDays - bookedDays);

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
        {...hoursInput}
      />
      {stored != null && amount > 0 && (
        <div className="cell-foot">
          <span className="cell-amount muted">
            {formatMoney(amount, project.currency)}
          </span>
          <span
            className={
              "cell-unbooked" + (unbookedDays < 0 ? " over" : "")
            }
            title={`${workDays} working days this month · ${round1(
              bookedDays
            )} booked`}
          >
            {unbookedDays < 0
              ? `${Math.abs(unbookedDays)} d over`
              : `${unbookedDays} d unbooked`}
          </span>
          {bill && bill.status === "pending" && (
            <button
              className="cell-action"
              title="Mark invoice sent"
              onClick={() => onStatus(bill.id, "sent")}
            >
              Invoice
            </button>
          )}
          {bill && bill.status === "sent" && (
            <button
              className="cell-action"
              title="Mark as paid"
              onClick={() => onStatus(bill.id, "received")}
            >
              Mark paid
            </button>
          )}
          {bill && bill.status === "received" && (
            <span className="cell-paid-tag">Paid ✓</span>
          )}
        </div>
      )}
    </td>
  );
}
