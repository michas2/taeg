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
    client?: string;
    stageId: string;
    hourlyRate: number;
    currency: string;
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
  const [client, setClient] = useState(project?.client ?? "");
  const [stageId, setStageId] = useState(project?.stageId ?? initialStageId);
  const [hourlyRate, setHourlyRate] = useState(
    project ? String(project.hourlyRate) : "100"
  );
  const [currency, setCurrency] = useState(project?.currency ?? "EUR");
  const [notes, setNotes] = useState(project?.notes ?? "");

  const canSave = name.trim().length > 0 && Number(hourlyRate) >= 0;

  function submit() {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      client: client.trim() || undefined,
      stageId,
      hourlyRate: Number(hourlyRate),
      currency: currency.trim().toUpperCase() || "EUR",
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
      <div>
        <label htmlFor="pf-client">Client</label>
        <input
          id="pf-client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="e.g. Acme Corp"
        />
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
      <div className="field-row">
        <div>
          <label htmlFor="pf-rate">Hourly rate</label>
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
          <label htmlFor="pf-currency">Currency</label>
          <input
            id="pf-currency"
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </div>
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
