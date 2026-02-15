/**
 * TaskTimeTracking component.
 * Displays time tracking summary for a task with breakdown,
 * person-hours display, and collapsible entry list.
 * Uses ExpandableSection for outer toggle.
 */

import { useState, useEffect } from 'react';
import { useTaskTimeBreakdown } from '../lib/hooks/useTaskTimeBreakdown';
import { useTimerStore } from '../lib/stores/timer-store';
import { getTimeEntriesByTask } from '../lib/db';
import { addManualEntry, updateEntry, deleteEntry } from '../lib/stores/entry-actions';
import { TimeEntry, formatDurationShort } from '../lib/types';
import { TimeEntryRow } from './TimeEntryRow';
import { EditEntryModal } from './EditEntryModal';
import { AddEntryModal } from './AddEntryModal';
import { ExpandableSection } from './ExpandableSection';
import { ClockIcon } from './icons';

interface TaskTimeTrackingProps {
  taskId: string;
  subtaskIds: string[];
}

export function TaskTimeTracking({ taskId, subtaskIds }: TaskTimeTrackingProps) {
  const { activeTimers } = useTimerStore();
  const { breakdown, isLoading, refresh } = useTaskTimeBreakdown(
    taskId,
    subtaskIds,
    activeTimers
  );

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showEntries, setShowEntries] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const loggedCount = entries.filter((e) => e.source === 'logged').length;

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

  const liveBadge = isTimerActive ? (
    <span className="task-time-tracking__live-indicator" aria-label="Timer running">
      Live
    </span>
  ) : undefined;

  return (
    <>
      <ExpandableSection
        label="Time Tracked"
        count={breakdown.entryCount}
        countVariant="primary"
        icon={<ClockIcon className="task-time-tracking__icon" />}
        defaultOpen={true}
        badge={liveBadge}
        timeBadgeMs={breakdown.totalMs}
      >
        {isLoading ? (
          <div className="task-time-tracking__loading">Loading...</div>
        ) : (
          <div className="task-time-tracking__content">
            {/* Total time - always shown */}
            <div className="task-time-tracking__total">
              <span className="task-time-tracking__label">Total</span>
              <span className="task-time-tracking__value">
                {formatDurationShort(breakdown.totalMs)}
              </span>
            </div>

            {/* Person-hours - shown only when any entry has workers > 1 */}
            {breakdown.hasMultipleWorkers && (
              <div className="task-time-tracking__total task-time-tracking__total--person">
                <span className="task-time-tracking__label">Person-hours</span>
                <span className="task-time-tracking__value task-time-tracking__value--person">
                  {formatDurationShort(breakdown.totalPersonMs)}
                </span>
              </div>
            )}

            {/* Breakdown - shown if there's time or subtasks */}
            {(hasTime || hasSubtasks) && (
              <div className="task-time-tracking__breakdown">
                <div className="task-time-tracking__row">
                  <span className="task-time-tracking__row-label">
                    Direct
                    {isTimerOnTask && <LiveDot />}
                  </span>
                  <span className="task-time-tracking__row-value">
                    {formatDurationShort(breakdown.directMs)}
                  </span>
                </div>

                {hasSubtasks && (
                  <div className="task-time-tracking__row">
                    <span className="task-time-tracking__row-label">
                      Subtasks ({subtaskIds.length})
                      {isTimerOnSubtask && <LiveDot />}
                    </span>
                    <span className="task-time-tracking__row-value">
                      {formatDurationShort(breakdown.subtaskMs)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Entry count + toggle (nested collapsible for entries) */}
            {(hasTime || breakdown.entryCount > 0) && (
              <button
                type="button"
                className="task-time-tracking__entries-toggle"
                onClick={() => setShowEntries(!showEntries)}
              >
                <span>
                  {breakdown.entryCount}{' '}
                  {breakdown.entryCount === 1 ? 'entry' : 'entries'}
                  {loggedCount > 0 && showEntries
                    ? ` \u00b7 ${loggedCount} crew-logged`
                    : ''}
                </span>
                <span className={`task-time-tracking__chevron ${showEntries ? 'task-time-tracking__chevron--open' : ''}`}>
                  &#x25B8;
                </span>
              </button>
            )}

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
