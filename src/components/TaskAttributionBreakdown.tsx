/**
 * TaskAttributionBreakdown — expandable section showing per-entry
 * attribution status/reason for a task and its subtasks.
 * Lazy-loads entries on expand. Supports reassignment via ReassignEntrySheet.
 */

import { useState } from 'react';
import type { AttributedEntry } from '../lib/types';
import { getTimeEntriesByTask } from '../lib/db';
import { attributeEntry } from '../lib/attribution/engine';
import { useTaskStore } from '../lib/stores/task-store';
import { ExpandableSection } from './ExpandableSection';
import { ReassignEntrySheet } from './ReassignEntrySheet';

interface TaskAttributionBreakdownProps {
  taskId: string;
  subtaskIds: string[];
}

const STATUS_LABELS: Record<string, string> = {
  attributed: 'Attributed',
  unattributed: 'Unattributed',
  ambiguous: 'Ambiguous',
};

const REASON_LABELS: Record<string, string> = {
  self: 'Self (measurable)',
  ancestor: 'Parent task',
  noMeasurableOwner: 'No measurable owner',
  multipleOwners: 'Multiple owners',
};

export function TaskAttributionBreakdown({ taskId, subtaskIds }: TaskAttributionBreakdownProps) {
  const { tasks } = useTaskStore();
  const [entries, setEntries] = useState<AttributedEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reassignEntry, setReassignEntry] = useState<{ entryId: string; taskId: string } | null>(null);

  const loadEntries = async () => {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const allIds = [taskId, ...subtaskIds];
    const allAttributed: AttributedEntry[] = [];

    for (const id of allIds) {
      const timeEntries = await getTimeEntriesByTask(id);
      for (const entry of timeEntries) {
        allAttributed.push(attributeEntry(entry, taskMap));
      }
    }

    allAttributed.sort((a, b) => b.entryId.localeCompare(a.entryId));
    setEntries(allAttributed);
    setLoaded(true);
  };

  const handleToggle = async (isOpen: boolean) => {
    if (isOpen && !loaded) {
      await loadEntries();
    }
  };

  const handleReassigned = () => {
    // Reload entries after reassignment
    loadEntries();
  };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return (
    <>
      <ExpandableSection
        label="ATTRIBUTION"
        defaultOpen={false}
        sectionSummary={loaded ? `${entries.length} entries` : undefined}
        onToggle={handleToggle}
      >
        {entries.length === 0 ? (
          <p className="settings-view__empty">No time entries for this task.</p>
        ) : (
          <div className="task-attribution-breakdown">
            {entries.map((entry) => {
              const ownerTask = entry.ownerTaskId ? taskMap.get(entry.ownerTaskId) : null;
              const loggedTask = taskMap.get(entry.taskId);

              return (
                <div key={entry.entryId} className="task-attribution-breakdown__entry">
                  <div className="task-attribution-breakdown__row">
                    <span className={`task-attribution-breakdown__status task-attribution-breakdown__status--${entry.status}`}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span className="task-attribution-breakdown__hours">
                      {entry.personHours.toFixed(2)} person-hrs
                    </span>
                  </div>
                  <div className="task-attribution-breakdown__detail">
                    <span className="task-attribution-breakdown__reason">
                      {REASON_LABELS[entry.reason] ?? entry.reason}
                    </span>
                    {loggedTask && entry.taskId !== taskId && (
                      <span className="task-attribution-breakdown__task">
                        logged on: {loggedTask.title}
                      </span>
                    )}
                    {ownerTask && (
                      <span className="task-attribution-breakdown__task">
                        owner: {ownerTask.title}
                      </span>
                    )}
                    {entry.suggestedOwnerTaskId && entry.suggestedOwnerTaskId !== entry.ownerTaskId && (
                      <span className="task-attribution-breakdown__suggestion">
                        suggested: {taskMap.get(entry.suggestedOwnerTaskId)?.title ?? entry.suggestedOwnerTaskId}
                        {entry.heuristicUsed && ` (${entry.heuristicUsed})`}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setReassignEntry({ entryId: entry.entryId, taskId: entry.taskId })}
                  >
                    Reassign
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ExpandableSection>

      {reassignEntry && (
        <ReassignEntrySheet
          isOpen={true}
          onClose={() => setReassignEntry(null)}
          entryId={reassignEntry.entryId}
          currentTaskId={reassignEntry.taskId}
          onReassigned={handleReassigned}
        />
      )}
    </>
  );
}
