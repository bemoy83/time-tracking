/**
 * TaskTimeTracking component.
 * Displays time tracking summary for a task with breakdown,
 * person-hours display, and collapsible entry list.
 * Uses ExpandableSection for outer toggle.
 */

import { useState, useEffect } from 'react';
import { useTaskTimeBreakdown } from '../lib/hooks/useTaskTimeBreakdown';
import { useTimerStore } from '../lib/stores/timer-store';
import { useTask } from '../lib/stores/task-store';
import { updateTaskEstimate } from '../lib/stores/task-store';
import { getTimeEntriesByTask } from '../lib/db';
import { addManualEntry, updateEntry, deleteEntry } from '../lib/stores/entry-actions';
import { TimeEntry, formatDurationShort, calculateBudgetStatus } from '../lib/types';
import { TimeEntryRow } from './TimeEntryRow';
import { EditEntryModal } from './EditEntryModal';
import { AddEntryModal } from './AddEntryModal';
import { EstimateInput } from './EstimateInput';
import { ExpandableSection } from './ExpandableSection';
import { TrackedVsEstimateBadge } from './TrackedVsEstimateBadge';
import { ClockIcon, PencilIcon } from './icons';
import { StatusProgressBar } from './StatusProgressBar';
import { pluralize } from '../lib/utils/pluralize';

interface TaskTimeTrackingProps {
  taskId: string;
  subtaskIds: string[];
}

export function TaskTimeTracking({ taskId, subtaskIds }: TaskTimeTrackingProps) {
  const { activeTimers } = useTimerStore();
  const task = useTask(taskId);
  const { breakdown, isLoading, refresh } = useTaskTimeBreakdown(
    taskId,
    subtaskIds,
    activeTimers
  );

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showEntries, setShowEntries] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);

  const budgetStatus = calculateBudgetStatus(breakdown.totalMs, task?.estimatedMinutes ?? null);

  const hasSubtasks = subtaskIds.length > 0;
  const hasTime = breakdown.totalMs > 0;

  // Check if timer is running on this task or any subtask
  const isTimerOnTask = activeTimers.some((t) => t.taskId === taskId);
  const isTimerOnSubtask = activeTimers.some((t) => subtaskIds.includes(t.taskId));
  const isTimerActive = isTimerOnTask || isTimerOnSubtask;

  // Reset entry list when navigating to a different task
  useEffect(() => {
    setEntries([]);
    setShowEntries(false);
  }, [taskId]);

  // Load entries when section is expanded or task/timer changes
  useEffect(() => {
    if (showEntries) {
      loadEntries();
    }
  }, [showEntries, taskId, activeTimers.map((t) => t.id).join(',')]);

  const loadEntries = async () => {
    const result = await getTimeEntriesByTask(taskId);
    // Sort newest first
    result.sort((a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime());
    setEntries(result);
  };

  const handleSaveEdit = async (changes: { durationMs: number; workers: number }) => {
    if (!editingEntry) return;
    await updateEntry(editingEntry.id, changes);
    setEditingEntry(null);
    await loadEntries();
    refresh();
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    setEditingEntry(null);
    await loadEntries();
    refresh();
  };

  const handleAddEntry = async (durationMs: number, workers: number) => {
    await addManualEntry(taskId, durationMs, workers);
    setShowAddModal(false);
    await loadEntries();
    refresh();
  };

  const handleSaveEstimate = async (estimateMinutes: number | null) => {
    await updateTaskEstimate(taskId, estimateMinutes);
    setShowEstimateModal(false);
  };

  const liveBadge = isTimerActive ? (
    <span className="task-time-tracking__live-indicator" aria-label="Timer running">
      Live
    </span>
  ) : undefined;

  return (
    <>
      <ExpandableSection
        label="TIME"
        icon={<ClockIcon className="task-time-tracking__icon" />}
        defaultOpen={true}
        badge={liveBadge}
        timeBadgeMs={breakdown.totalMs}
        estimatedMinutes={task?.estimatedMinutes ?? null}
        timeBadgeStatus={budgetStatus.status}
      >
        {isLoading ? (
          <div className="task-time-tracking__loading">Loading...</div>
        ) : (
          <div className="task-time-tracking__content">
            {/* Time tracked section */}
            <div className="task-time-tracking__total-section">
              <span className="task-time-tracking__section-label section-heading">TIME TRACKED</span>
              <div className="task-time-tracking__total">
                <span className="task-time-tracking__label-block">
                  <span className="task-time-tracking__label">Total</span>
                  {(hasTime || hasSubtasks) && (
                    <span className="task-time-tracking__breakdown-line">
                      {breakdown.directMs > 0 && (
                        <>{formatDurationShort(breakdown.directMs)} direct{isTimerOnTask && <LiveDot />}</>
                      )}
                      {breakdown.directMs > 0 && hasSubtasks && ' + '}
                      {hasSubtasks && (
                        <>{formatDurationShort(breakdown.subtaskMs)} from subtasks{isTimerOnSubtask && <LiveDot />}</>
                      )}
                    </span>
                  )}
                </span>
                <span className="task-time-tracking__value">
                  {formatDurationShort(breakdown.totalMs)}
                </span>
              </div>

              {/* Person-hours - shown only when any entry has workers > 1 */}
              {breakdown.hasMultipleWorkers && (
                <div className="task-time-tracking__total task-time-tracking__total--person">
                  <span className="task-time-tracking__label-block">
                    <span className="task-time-tracking__label">Person-hours</span>
                    {(hasTime || hasSubtasks) && (
                      <span className="task-time-tracking__breakdown-line">
                        {breakdown.directPersonMs > 0 && (
                          <>{formatDurationShort(breakdown.directPersonMs)} direct{isTimerOnTask && <LiveDot />}</>
                        )}
                        {breakdown.directPersonMs > 0 && hasSubtasks && ' + '}
                        {hasSubtasks && (
                          <>{formatDurationShort(breakdown.subtaskPersonMs)} from subtasks{isTimerOnSubtask && <LiveDot />}</>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="task-time-tracking__value task-time-tracking__value--person">
                    {formatDurationShort(breakdown.totalPersonMs)}
                  </span>
                </div>
              )}
            </div>

            {/* Time estimate section */}
            <div className="task-time-tracking__estimate-section">
              <span className="task-time-tracking__section-label section-heading">TIME ESTIMATE</span>
              {budgetStatus.status !== 'none' ? (
                <div className="task-time-tracking__estimate-summary">
                  <div className="task-time-tracking__estimate-heading">
                    <span className="task-time-tracking__estimate-metrics">
                      <TrackedVsEstimateBadge
                        trackedMs={breakdown.totalMs}
                        estimatedMinutes={task?.estimatedMinutes ?? null}
                        status={budgetStatus.status}
                      />
                      <span className={`task-time-tracking__variance task-time-tracking__variance--${budgetStatus.status}`}>
                        {budgetStatus.varianceText}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="task-time-tracking__estimate-btn"
                      onClick={() => setShowEstimateModal(true)}
                      aria-label={`Edit estimate (${formatDurationShort((task?.estimatedMinutes ?? 0) * 60_000)})`}
                    >
                      <PencilIcon className="task-time-tracking__icon" />
                    </button>
                  </div>
                  <StatusProgressBar
                    percent={Math.min(Math.round(budgetStatus.percentUsed), 100)}
                    status={budgetStatus.status as 'under' | 'approaching' | 'over'}
                    label={`${Math.round(budgetStatus.percentUsed)}%`}
                    height={6}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="task-time-tracking__set-estimate"
                  onClick={() => setShowEstimateModal(true)}
                >
                  + Set estimate
                </button>
              )}
            </div>

            {/* Entry header as expand toggle */}
            <div className="task-time-tracking__entries-section">
              <button
                type="button"
                className="task-time-tracking__entries-header"
                onClick={() => setShowEntries(!showEntries)}
                aria-expanded={showEntries}
              >
                <span className="task-time-tracking__section-label section-heading">TIME ENTRIES</span>
                {!showEntries && (hasTime || breakdown.entryCount > 0) && (
                  <span className="task-time-tracking__entries-count">
                    {pluralize(breakdown.entryCount, 'entry', 'entries')}
                  </span>
                )}
                <span className={`expandable-section__chevron ${showEntries ? 'expandable-section__chevron--open' : ''}`}>
                  &#x25B8;
                </span>
              </button>

            {/* Entry list (collapsible) */}
            {showEntries && (
              <div className="task-time-tracking__entry-list">
                {entries.map((entry) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    onTap={setEditingEntry}
                  />
                ))}
              </div>
            )}

            {/* Log time button - always visible so you can add to a fresh task */}
            <button
              type="button"
              className="task-time-tracking__add-entry"
              onClick={() => setShowAddModal(true)}
            >
              + Log time
            </button>
            </div>
          </div>
        )}
      </ExpandableSection>

      {/* Edit entry modal */}
      {editingEntry && (
        <EditEntryModal
          isOpen={!!editingEntry}
          entry={editingEntry}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Add entry modal */}
      <AddEntryModal
        isOpen={showAddModal}
        onSave={handleAddEntry}
        onClose={() => setShowAddModal(false)}
      />

      {/* Estimate modal */}
      <EstimateInput
        isOpen={showEstimateModal}
        currentEstimate={task?.estimatedMinutes ?? null}
        onSave={handleSaveEstimate}
        onClose={() => setShowEstimateModal(false)}
      />
    </>
  );
}

function LiveDot() {
  return (
    <span
      className="task-time-tracking__live-dot"
      aria-label="Timer active"
    />
  );
}
