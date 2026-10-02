import { useMemo, useState } from "react";
import { useStore, useActions } from "../store/store";
import {
  billsForProject,
  billRate,
  billAmount,
  isOverdue,
  isProjectBillable,
} from "../domain/selectors";
import type { BillStatus, MonthlyBill } from "../domain/types";
import {
  formatMoney,
  monthLabel,
  currentMonthKey,
} from "../utils/helpers";
import "./ProjectBilling.css";

interface ProjectBillingProps {
  projectId: string;
  onBack: () => void;
}

const STATUS_LABEL: Record<BillStatus, string> = {
  pending: "Pending",
  sent: "Invoice sent",
  received: "Paid",
};

export function ProjectBilling({ projectId, onBack }: ProjectBillingProps) {
  const { db } = useStore();
  const actions = useActions();
  const project = db.projects[projectId];
  const bills = useMemo(
    () => (project ? billsForProject(db, projectId) : []),
    [db, projectId, project]
  );
  const [addMonth, setAddMonth] = useState(currentMonthKey());

  if (!project) {
    return (
      <div className="placeholder">
        <button className="ghost" onClick={onBack}>
          ← Back to board
        </button>
        <p className="muted">This project no longer exists.</p>
      </div>
    );
  }

  const stage = db.stages[project.stageId];
  const billable = isProjectBillable(db, project);

  // Totals (this project is single-currency).
  const totals = bills.reduce(
    (acc, b) => {
      const amt = billAmount(b, project);
      acc.billed += amt;
      if (b.status === "received") acc.received += amt;
      else acc.outstanding += amt;
      return acc;
    },
    { billed: 0, received: 0, outstanding: 0 }
  );

  function addBillRow() {
    actions.ensureBill(projectId, addMonth);
  }

  return (
    <div className="billing">
      <div className="billing-top">
        <button className="ghost" onClick={onBack}>
          ← Board
        </button>
      </div>

      <header className="billing-head">
        <div>
          <h2>{project.name}</h2>
          <div className="muted">
            {[project.customer, stage?.name].filter(Boolean).join(" · ")}
            {!billable && " · not billable in this stage"}
          </div>
          {project.recruiter && (
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              Invoice to: {project.recruiter}
            </div>
          )}
        </div>
        <div className="rate-edit">
          <label htmlFor="rate">Hourly rate</label>
          <div className="rate-row">
            <input
              id="rate"
              type="number"
              min="0"
              value={project.hourlyRate}
              onChange={(e) =>
                actions.updateProject(projectId, {
                  hourlyRate: Number(e.target.value),
                })
              }
            />
            <span className="muted">{project.currency}/h</span>
          </div>
        </div>
      </header>

      <div className="totals">
        <SummaryCard
          label="Billed (reported)"
          value={formatMoney(totals.billed, project.currency)}
        />
        <SummaryCard
          label="Received"
          value={formatMoney(totals.received, project.currency)}
          tone="green"
        />
        <SummaryCard
          label="Outstanding"
          value={formatMoney(totals.outstanding, project.currency)}
          tone={totals.outstanding > 0 ? "amber" : undefined}
        />
      </div>

      <div className="add-month">
        <input
          type="month"
          value={addMonth}
          onChange={(e) => setAddMonth(e.target.value)}
        />
        <button onClick={addBillRow}>+ Add billing month</button>
      </div>

      <table className="bills">
        <thead>
          <tr>
            <th>Month</th>
            <th>Hours</th>
            <th>Rate</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 && (
            <tr>
              <td colSpan={6} className="muted empty">
                No billing months yet. Add one above.
              </td>
            </tr>
          )}
          {bills.map((bill) => (
            <BillRow
              key={bill.id}
              bill={bill}
              rate={billRate(bill, project)}
              currency={project.currency}
              amount={billAmount(bill, project)}
              overdue={isOverdue(bill)}
              onHours={(h) => actions.setBillHours(projectId, bill.month, h)}
              onStatus={(s) => actions.setBillStatus(bill.id, s)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber";
}) {
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className={"summary-value" + (tone ? " " + tone : "")}>{value}</div>
    </div>
  );
}

function BillRow({
  bill,
  rate,
  currency,
  amount,
  overdue,
  onHours,
  onStatus,
}: {
  bill: MonthlyBill;
  rate: number;
  currency: string;
  amount: number;
  overdue: boolean;
  onHours: (hours: number | null) => void;
  onStatus: (status: BillStatus) => void;
}) {
  const [draft, setDraft] = useState(
    bill.hours == null ? "" : String(bill.hours)
  );

  function commit() {
    const trimmed = draft.trim();
    onHours(trimmed === "" ? null : Number(trimmed));
  }

  const missing = bill.hours == null;

  return (
    <tr className={missing ? "row-missing" : undefined}>
      <td>
        <div>{monthLabel(bill.month)}</div>
        <div className="muted mono">{bill.month}</div>
      </td>
      <td>
        <input
          className="hours-input"
          type="number"
          min="0"
          step="0.5"
          placeholder="—"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </td>
      <td className="mono">{formatMoney(rate, currency)}</td>
      <td className="mono">{missing ? "—" : formatMoney(amount, currency)}</td>
      <td>
        <div className="status-cell">
          <span className={"badge " + statusTone(bill.status, overdue)}>
            {overdue ? "Overdue" : STATUS_LABEL[bill.status]}
          </span>
        </div>
      </td>
      <td>
        <div className="row-actions">
          {bill.status === "pending" && (
            <button
              className="ghost"
              disabled={missing}
              title={missing ? "Enter hours first" : "Mark invoice sent"}
              onClick={() => onStatus("sent")}
            >
              Mark sent
            </button>
          )}
          {bill.status === "sent" && (
            <>
              <button className="ghost" onClick={() => onStatus("received")}>
                Mark paid
              </button>
              <button className="ghost" onClick={() => onStatus("pending")}>
                Undo
              </button>
            </>
          )}
          {bill.status === "received" && (
            <button className="ghost" onClick={() => onStatus("sent")}>
              Undo paid
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function statusTone(status: BillStatus, overdue: boolean): string {
  if (overdue) return "red";
  if (status === "received") return "green";
  if (status === "sent") return "amber";
  return "dim";
}
