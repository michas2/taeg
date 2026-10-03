import { useState } from "react";
import type { Project, Stage } from "../domain/types";
import { Modal } from "./Modal";

interface ProjectFormProps {
  stages: Stage[];
  initialStageId: string;
  project?: Project;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    customer?: string;
    recruiter?: string;
    stageId: string;
    hourlyRate: number;
    notes?: string;
  }) => void;
}

export function ProjectForm({
  stages,
  initialStageId,
  project,
  onClose,
  onSubmit,
}: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [customer, setCustomer] = useState(project?.customer ?? "");
  const [recruiter, setRecruiter] = useState(project?.recruiter ?? "");
  const [stageId, setStageId] = useState(project?.stageId ?? initialStageId);
  const [hourlyRate, setHourlyRate] = useState(
    project ? String(project.hourlyRate) : "100"
  );
  const [notes, setNotes] = useState(project?.notes ?? "");

  const canSave = name.trim().length > 0 && Number(hourlyRate) >= 0;

  function submit() {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      customer: customer.trim() || undefined,
      recruiter: recruiter.trim() || undefined,
      stageId,
      hourlyRate: Number(hourlyRate),
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      title={project ? "Edit project" : "New project"}
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!canSave} onClick={submit}>
            {project ? "Save" : "Create"}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="pf-name">Project name</label>
        <input
          id="pf-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Platform Rebuild"
        />
      </div>
      <div className="field-row">
        <div>
          <label htmlFor="pf-customer">Customer</label>
          <input
            id="pf-customer"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="who you work for"
          />
        </div>
        <div>
          <label htmlFor="pf-recruiter">Recruiter</label>
          <input
            id="pf-recruiter"
            value={recruiter}
            onChange={(e) => setRecruiter(e.target.value)}
            placeholder="who you invoice"
          />
        </div>
      </div>
      <div>
        <label htmlFor="pf-stage">Stage</label>
        <select
          id="pf-stage"
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.billable ? " (billable)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pf-rate">Hourly rate (€/h)</label>
        <input
          id="pf-rate"
          type="number"
          min="0"
          step="1"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="pf-notes">Notes</label>
        <textarea
          id="pf-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
