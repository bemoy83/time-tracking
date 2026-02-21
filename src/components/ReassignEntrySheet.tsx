/**
 * ReassignEntrySheet — ActionSheet for reassigning a time entry to a different task.
 * Shows a filtered task picker and reason input.
 */

import { useState } from 'react';
import { useTaskStore } from '../lib/stores/task-store';
import { reassignTimeEntry } from '../lib/reassignment';
import { ActionSheet } from './ActionSheet';

interface ReassignEntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: string;
  currentTaskId: string;
  onReassigned: () => void;
}

export function ReassignEntrySheet({
  isOpen,
  onClose,
  entryId,
  currentTaskId,
  onReassigned,
}: ReassignEntrySheetProps) {
  const { tasks } = useTaskStore();
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter: exclude current task and completed tasks
  const eligibleTasks = tasks.filter(
    (t) => t.id !== currentTaskId && t.status !== 'completed'
  );

  const handleSubmit = async () => {
    if (!selectedTaskId || !reason.trim()) return;
    setIsSubmitting(true);
    try {
      await reassignTimeEntry(entryId, selectedTaskId, reason.trim());
      setSelectedTaskId('');
      setReason('');
      onReassigned();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTaskId('');
    setReason('');
    onClose();
  };

  return (
    <ActionSheet isOpen={isOpen} title="Reassign Entry" onClose={handleClose}>
      <div className="create-task-sheet__form">
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Move to Task</label>
          <select
            className="input"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            <option value="">Select a task...</option>
            {eligibleTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Reason</label>
          <input
            type="text"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this entry being reassigned?"
          />
        </div>

        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSubmit}
              disabled={!selectedTaskId || !reason.trim() || isSubmitting}
            >
              Reassign
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
