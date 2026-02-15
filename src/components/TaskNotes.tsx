/**
 * TaskNotes component.
 * Collapsible activity log section for a task.
 * Append-only: add notes, view newest-first, no edit/delete.
 * Uses ExpandableSection for toggle behavior.
 */

import { useState, useEffect, useCallback } from 'react';
import { TaskNote } from '../lib/types';
import { addNote, getNotesByTask, subscribeNotes } from '../lib/stores/note-actions';
import { ExpandableSection } from './ExpandableSection';

interface TaskNotesProps {
  taskId: string;
}

export function TaskNotes({ taskId }: TaskNotesProps) {
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    const result = await getNotesByTask(taskId);
    setNotes(result);
  }, [taskId]);

  // Reset when navigating to different task
  useEffect(() => {
    setNotes([]);
    setIsOpen(false);
    setText('');
  }, [taskId]);

  // Load notes when expanded, and re-load on changes
  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, loadNotes]);

  // Subscribe to note changes
  useEffect(() => {
    if (!isOpen) return;
    return subscribeNotes(() => {
      loadNotes();
    });
  }, [isOpen, loadNotes]);

  // Always load note count (lightweight)
  useEffect(() => {
    getNotesByTask(taskId).then(setNotes);
  }, [taskId]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    await addNote(taskId, trimmed);
    setText('');
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <ExpandableSection
      label="Notes"
      count={notes.length}
      countVariant="primary"
      defaultOpen={false}
      onToggle={handleToggle}
    >
      {/* Input at top */}
      <div className="task-notes__input-row">
        <input
          type="text"
          className="task-notes__input input"
          placeholder="Add a note..."
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          onKeyDown={handleKeyDown}
          maxLength={280}
        />
        <button
          type="button"
          className="task-notes__add-btn"
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
        >
          Add
        </button>
      </div>

      {/* Notes list, newest first */}
      {notes.length > 0 ? (
        <div className="task-notes__list">
          {notes.map((note) => (
            <div key={note.id} className="task-notes__item">
              <span className="task-notes__timestamp">
                {formatRelativeTime(note.createdAt)}
              </span>
              <span className="task-notes__text">{note.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="task-notes__empty">No notes yet</p>
      )}
    </ExpandableSection>
  );
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
