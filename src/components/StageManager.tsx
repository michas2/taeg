import { useState } from "react";
import type { Stage } from "../domain/types";
import { Modal } from "./Modal";
import { useActions } from "../store/store";
import "./StageManager.css";

interface StageManagerProps {
  stages: Stage[];
  projectCountByStage: Record<string, number>;
  onClose: () => void;
}

/** Add / rename / reorder / toggle-billable / delete workflow stages. */
export function StageManager({
  stages,
  projectCountByStage,
  onClose,
}: StageManagerProps) {
  const actions = useActions();
  const [newName, setNewName] = useState("");

  function move(stage: Stage, dir: -1 | 1) {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    // Swap order values.
    actions.reorderStage(stage.id, swapWith.order);
    actions.reorderStage(swapWith.id, stage.order);
  }

  function remove(stage: Stage) {
    const count = projectCountByStage[stage.id] ?? 0;
    const others = stages.filter((s) => s.id !== stage.id);
    if (others.length === 0) {
      alert("You can't delete the last stage.");
      return;
    }
    const msg =
      count > 0
        ? `Delete "${stage.name}"? Its ${count} project(s) will move to "${others[0].name}".`
        : `Delete "${stage.name}"?`;
    if (confirm(msg)) actions.removeStage(stage.id, others[0].id);
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    actions.addStage({ name });
    setNewName("");
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);

  return (
    <Modal
      title="Configure stages"
      onClose={onClose}
      footer={
        <button className="primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
        Stages are your workflow columns. Mark a stage{" "}
        <strong>billable</strong> to generate monthly bills for its projects.
      </p>

      <div className="stage-list">
        {sorted.map((stage, i) => (
          <div className="stage-row" key={stage.id}>
            <div className="stage-reorder">
              <button
                className="ghost"
                disabled={i === 0}
                onClick={() => move(stage, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="ghost"
                disabled={i === sorted.length - 1}
                onClick={() => move(stage, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
            <input
              value={stage.name}
              onChange={(e) =>
                actions.updateStage(stage.id, { name: e.target.value })
              }
            />
            <label className="stage-billable" title="Generate monthly bills">
              <input
                type="checkbox"
                checked={stage.billable}
                onChange={(e) =>
                  actions.updateStage(stage.id, { billable: e.target.checked })
                }
                style={{ width: "auto" }}
              />
              billable
            </label>
            <button
              className="ghost danger"
              onClick={() => remove(stage)}
              aria-label={`Delete ${stage.name}`}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <div className="field-row">
        <input
          value={newName}
          placeholder="New stage name"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="primary" style={{ flex: "0 0 auto" }} onClick={add}>
          Add stage
        </button>
      </div>
    </Modal>
  );
}
