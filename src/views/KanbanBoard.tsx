import { useMemo, useState } from "react";
import { useStore, useActions } from "../store/store";
import {
  stagesSorted,
  projectsInStage,
  billsForProject,
} from "../domain/selectors";
import type { Project } from "../domain/types";
import { formatMoney } from "../utils/helpers";
import { ProjectForm } from "../components/ProjectForm";
import { StageManager } from "../components/StageManager";
import "./KanbanBoard.css";

interface KanbanBoardProps {
  onOpenProject: (projectId: string) => void;
}

export function KanbanBoard({ onOpenProject }: KanbanBoardProps) {
  const { db } = useStore();
  const actions = useActions();
  const stages = useMemo(() => stagesSorted(db), [db]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showStageManager, setShowStageManager] = useState(false);
  const [formState, setFormState] = useState<
    | { mode: "new"; stageId: string }
    | { mode: "edit"; project: Project }
    | null
  >(null);

  const projectCountByStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of Object.values(db.projects)) {
      counts[p.stageId] = (counts[p.stageId] ?? 0) + 1;
    }
    return counts;
  }, [db.projects]);

  function handleDrop(stageId: string) {
    if (draggingId) actions.moveProjectToStage(draggingId, stageId);
    setDraggingId(null);
    setDragOverStage(null);
  }

  return (
    <div className="board-wrap">
      <div className="board-toolbar">
        <div className="muted">
          {Object.keys(db.projects).length} projects across {stages.length}{" "}
          stages
        </div>
        <button onClick={() => setShowStageManager(true)}>
          Configure stages
        </button>
      </div>

      <div className="board">
        {stages.map((stage) => {
          const projects = projectsInStage(db, stage.id);
          return (
            <section
              key={stage.id}
              className={
                "column" + (dragOverStage === stage.id ? " drag-over" : "")
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() =>
                setDragOverStage((cur) => (cur === stage.id ? null : cur))
              }
              onDrop={() => handleDrop(stage.id)}
            >
              <header className="column-head">
                <span
                  className="column-dot"
                  style={{ background: stage.color ?? "var(--text-dim)" }}
                />
                <h3>{stage.name}</h3>
                <span className="column-count">{projects.length}</span>
                {stage.billable && <span className="badge green">billable</span>}
              </header>

              <div className="column-body">
                {projects.map((project) => {
                  const latest = billsForProject(db, project.id)[0];
                  return (
                    <article
                      key={project.id}
                      className={
                        "card" + (draggingId === project.id ? " dragging" : "")
                      }
                      draggable
                      onDragStart={() => setDraggingId(project.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => onOpenProject(project.id)}
                    >
                      <div className="card-title">{project.name}</div>
                      {project.customer && (
                        <div className="card-client">{project.customer}</div>
                      )}
                      {project.recruiter &&
                        project.recruiter !== project.customer && (
                          <div className="card-client muted">
                            via {project.recruiter}
                          </div>
                        )}
                      <div className="card-meta">
                        <span>
                          {formatMoney(project.hourlyRate)}/h
                        </span>
                        {latest && (
                          <span className="muted">
                            last: {latest.month}
                          </span>
                        )}
                      </div>
                      <div className="card-actions">
                        <button
                          className="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormState({ mode: "edit", project });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(`Delete project "${project.name}"?`)
                            )
                              actions.removeProject(project.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}

                <button
                  className="add-card ghost"
                  onClick={() =>
                    setFormState({ mode: "new", stageId: stage.id })
                  }
                >
                  + Add project
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {showStageManager && (
        <StageManager
          stages={stages}
          projectCountByStage={projectCountByStage}
          onClose={() => setShowStageManager(false)}
        />
      )}

      {formState && (
        <ProjectForm
          stages={stages}
          initialStageId={
            formState.mode === "new"
              ? formState.stageId
              : formState.project.stageId
          }
          project={formState.mode === "edit" ? formState.project : undefined}
          onClose={() => setFormState(null)}
          onSubmit={(input) => {
            if (formState.mode === "new") actions.addProject(input);
            else actions.updateProject(formState.project.id, input);
          }}
        />
      )}
    </div>
  );
}
