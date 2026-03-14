import { useEffect, useMemo, useState } from 'react';
import { ActionSheet } from './ActionSheet';
import { useTaskStore } from '../lib/stores/task-store';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import {
  classifyTaskToWorkType,
  createAndClassifyFromTask,
  WorkTypeConflictError,
  type ClassifyTaskToWorkTypeResult,
  type CreateAndClassifyTaskResult,
} from '../lib/remediation/worktype-classify';
import {
  BUILD_PHASE_LABELS,
  WORK_UNIT_LABELS,
} from '../lib/types';
import type { WorkUnit } from '../lib/types';

type AssignMode = 'existing' | 'create';

interface RemediationWorkTypeAssignSheetProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  entryId?: string | null;
  recommendedWorkTypeId?: string | null;
  initialMode?: AssignMode;
  onAssigned: (result: ClassifyTaskToWorkTypeResult | CreateAndClassifyTaskResult) => void;
}

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

export function RemediationWorkTypeAssignSheet({
  isOpen,
  onClose,
  taskId,
  entryId = null,
  recommendedWorkTypeId = null,
  initialMode = 'existing',
  onAssigned,
}: RemediationWorkTypeAssignSheetProps) {
  const { tasks } = useTaskStore();
  const { workTypes } = useWorkTypeStore();
  const task = useMemo(() => tasks.find((candidate) => candidate.id === taskId) ?? null, [tasks, taskId]);

  const [mode, setMode] = useState<AssignMode>('existing');
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState('');
  const [reason, setReason] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createWorkUnit, setCreateWorkUnit] = useState<WorkUnit>('m2');
  const [createBuildUpRate, setCreateBuildUpRate] = useState('10');
  const [createTearDownRate, setCreateTearDownRate] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictWorkTypeId, setConflictWorkTypeId] = useState<string | null>(null);

  const selectedWorkType = workTypes.find((wt) => wt.id === selectedWorkTypeId) ?? null;
  const parsedBuildUpRate = parseFloat(createBuildUpRate) || 0;
  const parsedTearDownRate = parseFloat(createTearDownRate) || 0;

  useEffect(() => {
    if (!isOpen) return;
    const preferred = recommendedWorkTypeId ?? task?.workTypeId ?? workTypes[0]?.id ?? '';
    const defaultRate = task?.targetProductivity != null && task.targetProductivity > 0
      ? task.targetProductivity
      : 10;
    setMode(initialMode);
    setSelectedWorkTypeId(preferred);
    setReason('');
    setCreateTitle(task?.title ?? '');
    setCreateWorkUnit(task?.workUnit ?? 'm2');
    setCreateBuildUpRate(String(task?.buildPhase !== 'dismantle' ? defaultRate : 0));
    setCreateTearDownRate(String(task?.buildPhase === 'dismantle' ? defaultRate : 0));
    setError(null);
    setConflictWorkTypeId(null);
    setIsSubmitting(false);
  }, [
    initialMode,
    isOpen,
    recommendedWorkTypeId,
    task?.buildPhase,
    task?.targetProductivity,
    task?.title,
    task?.workTypeId,
    task?.workUnit,
    workTypes,
  ]);

  const canSubmitExisting = mode === 'existing'
    && selectedWorkTypeId.trim().length > 0
    && reason.trim().length > 0
    && !isSubmitting;

  const canSubmitCreate = mode === 'create'
    && createTitle.trim().length > 0
    && (parsedBuildUpRate > 0 || parsedTearDownRate > 0)
    && reason.trim().length > 0
    && !isSubmitting;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleAssignExisting = async (workTypeId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const auditDetails = entryId ? `Entry ${entryId}` : 'Task';
      const result = await classifyTaskToWorkType(taskId, workTypeId, reason.trim(), auditDetails);
      onAssigned(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign WorkType.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'existing') {
      if (!canSubmitExisting) return;
      await handleAssignExisting(selectedWorkTypeId);
      return;
    }
    if (!canSubmitCreate) return;

    setIsSubmitting(true);
    setError(null);
    setConflictWorkTypeId(null);
    try {
      const result = await createAndClassifyFromTask(
        taskId,
        {
          title: createTitle.trim(),
          workUnit: createWorkUnit,
          assemblyRate: parsedBuildUpRate,
          dismantleRate: parsedTearDownRate,
        },
        reason.trim(),
      );
      onAssigned(result);
      onClose();
    } catch (err) {
      if (err instanceof WorkTypeConflictError) {
        setConflictWorkTypeId(err.existingWorkTypeId);
        setError(`${err.message} Use existing WorkType to continue.`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create and assign WorkType.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActionSheet isOpen={isOpen} title="Assign WorkType" onClose={handleClose}>
      <div className="create-task-sheet__form">
        <div className="settings-view__list">
          <div className="settings-view__row">
            <div className="settings-view__template-info">
              <span className="settings-view__row-label">{task?.title ?? taskId}</span>
              <span className="settings-view__row-detail">
                Quantity: {task?.workQuantity != null ? task.workQuantity : 'not set'} ·
                Unit: {task?.workUnit != null ? WORK_UNIT_LABELS[task.workUnit] : 'not set'} ·
                Phase: {task?.buildPhase != null ? BUILD_PHASE_LABELS[task.buildPhase] : 'not set'}
              </span>
            </div>
          </div>
        </div>

        {task && (task.workQuantity == null || task.workQuantity <= 0) && (
          <p className="settings-view__helper">
            Classification can be saved now. KPI will include this task after quantity is set.
          </p>
        )}

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Mode</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Assignment mode">
            <button
              type="button"
              className={`task-work-quantity__unit-pill${mode === 'existing' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setMode('existing')}
            >
              Assign Existing
            </button>
            <button
              type="button"
              className={`task-work-quantity__unit-pill${mode === 'create' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setMode('create')}
            >
              Create + Assign
            </button>
          </div>
        </div>

        {mode === 'existing' && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">WorkType</label>
            <select
              className="input"
              value={selectedWorkTypeId}
              onChange={(event) => setSelectedWorkTypeId(event.target.value)}
            >
              <option value="">Select WorkType...</option>
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.title} ({WORK_UNIT_LABELS[wt.workUnit]})
                </option>
              ))}
            </select>
            {selectedWorkType && (
              <p className="settings-view__helper">
                Assembly: {selectedWorkType.assemblyRate} · Dismantle: {selectedWorkType.dismantleRate} {WORK_UNIT_LABELS[selectedWorkType.workUnit]}/person-hr
              </p>
            )}
          </div>
        )}

        {mode === 'create' && (
          <>
            <div className="create-task-sheet__section">
              <label className="entry-modal__label">WorkType Title</label>
              <input
                type="text"
                className="input"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Work type title"
              />
            </div>

            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Work Unit</label>
              <div className="task-work-quantity__unit-pills" role="group" aria-label="Work unit">
                {WORK_UNITS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={`task-work-quantity__unit-pill${createWorkUnit === unit ? ' task-work-quantity__unit-pill--active' : ''}`}
                    onClick={() => setCreateWorkUnit(unit)}
                  >
                    {WORK_UNIT_LABELS[unit]}
                  </button>
                ))}
              </div>
            </div>

            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Assembly Rate</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={createBuildUpRate}
                  onChange={(event) => setCreateBuildUpRate(event.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(createBuildUpRate || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden="true">
                  {WORK_UNIT_LABELS[createWorkUnit]}/person-hr
                </span>
              </div>
            </div>

            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Dismantle Rate</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={createTearDownRate}
                  onChange={(event) => setCreateTearDownRate(event.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(createTearDownRate || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden="true">
                  {WORK_UNIT_LABELS[createWorkUnit]}/person-hr
                </span>
              </div>
            </div>
          </>
        )}

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Reason</label>
          <input
            type="text"
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required for audit trail"
          />
        </div>

        {error && (
          <p className="settings-view__helper" style={{ color: 'var(--color-danger, #dc2626)' }}>
            {error}
          </p>
        )}

        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            {conflictWorkTypeId && (
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                disabled={isSubmitting || !reason.trim()}
                onClick={() => {
                  void handleAssignExisting(conflictWorkTypeId);
                }}
              >
                Use Existing
              </button>
            )}
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={mode === 'existing' ? !canSubmitExisting : !canSubmitCreate}
            >
              {isSubmitting
                ? 'Saving...'
                : (mode === 'existing' ? 'Assign WorkType' : 'Create + Assign')}
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
