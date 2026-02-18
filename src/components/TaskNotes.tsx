/**
 * TaskNotes component.
 * Collapsible activity log section for a task.
 * Append-only: add notes via ActionSheet, view newest-first, no edit/delete.
 * Uses ExpandableSection for toggle behavior.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TaskNote } from '../lib/types';
import { addNote, getNotesByTask, subscribeNotes } from '../lib/stores/note-actions';
import { ExpandableSection } from './ExpandableSection';
import { ActionSheet } from './ActionSheet';
import { pluralize } from '../lib/utils/pluralize';
import { formatUiDate } from '../lib/utils/formatUiDate';

const MAX_LENGTH = 280;

interface TaskNotesProps {
  taskId: string;
}

export function TaskNotes({ taskId }: TaskNotesProps) {
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = useCallback(async () => {
    const result = await getNotesByTask(taskId);
    setNotes(result);
  }, [taskId]);

  // Reset when navigating to different task
  useEffect(() => {
    setNotes([]);
    setIsOpen(false);
    setText('');
    setShowSheet(false);
  }, [taskId]);

  // Load notes when section is expanded
  useEffect(() => {
    if (isOpen) loadNotes();
  }, [isOpen, loadNotes]);

  // Subscribe to note changes while expanded
  useEffect(() => {
    if (!isOpen) return;
    return subscribeNotes(() => loadNotes());
  }, [isOpen, loadNotes]);

  // Always load note count for the collapsed summary badge
  useEffect(() => {
    getNotesByTask(taskId).then(setNotes);
  }, [taskId]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const handleOpenSheet = () => {
    setText('');
    setShowSheet(true);
  };

  const handleCloseSheet = () => {
    setShowSheet(false);
    setText('');
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    await addNote(taskId, trimmed);
    setIsSubmitting(false);
    handleCloseSheet();
    loadNotes();
  };

  const notesSummary = notes.length > 0 ? pluralize(notes.length, 'note') : undefined;
  const remaining = MAX_LENGTH - text.length;

  return (
    <>
      <ExpandableSection
        label="Notes"
        sectionSummary={notesSummary}
        defaultOpen={false}
        onToggle={setIsOpen}
      >
        {/* Notes list, newest first */}
        {notes.length > 0 ? (
          <div className="task-notes__list">
            {notes.map((note) => (
              <div key={note.id} className="task-notes__item">
                <span className="task-notes__timestamp">
                  {formatUiDate(note.createdAt, 'relative')}
                </span>
                <span className="task-notes__text">{note.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="task-notes__empty">No notes yet</p>
        )}

        <button
          type="button"
          className="task-notes__add-btn"
          onClick={handleOpenSheet}
        >
          + Add note
        </button>
      </ExpandableSection>

      <ActionSheet
        isOpen={showSheet}
        title="Add Note"
        onClose={handleCloseSheet}
      >
        <div className="task-notes__sheet-form">
          <textarea
            ref={textareaRef}
            className="task-notes__textarea"
            placeholder="Write a note..."
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            rows={3}
            autoFocus
          />
          <span className={`task-notes__counter${remaining <= 40 ? ' task-notes__counter--warn' : ''}`}>
            {remaining}
          </span>
        </div>
        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={handleCloseSheet}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSubmit}
              disabled={!text.trim() || isSubmitting}
            >
              Add
            </button>
          </div>
        </div>
      </ActionSheet>
    </>
  );
}
