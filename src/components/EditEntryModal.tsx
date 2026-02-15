/**
 * EditEntryModal component.
 * Modal for editing an existing time entry's duration and workers.
 * Also supports deleting the entry with confirmation.
 */

import { useState, useRef } from 'react';
import { TimeEntry, durationMs, formatDurationShort } from '../lib/types';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WorkersStepper } from './WorkersStepper';
import { TrashIcon } from './icons';

interface EditEntryModalProps {
  isOpen: boolean;
  entry: TimeEntry;
  onSave: (changes: { durationMs: number; workers: number }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EditEntryModal({
  isOpen,
  entry,
  onSave,
  onDelete,
  onClose,
}: EditEntryModalProps) {
  const dur = durationMs(entry.startUtc, entry.endUtc);
  const initialHours = Math.floor(dur / 3600000);
  const initialMinutes = Math.floor((dur % 3600000) / 60000);

  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [workers, setWorkers] = useState(entry.workers ?? 1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, saveBtnRef);

  if (!isOpen) return null;

  const totalMs = hours * 3600000 + minutes * 60000;
  const personMs = totalMs * workers;

  const handleSave = () => {
    if (totalMs <= 0) return;
    onSave({ durationMs: totalMs, workers });
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(entry.id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const clampHours = (v: number) => Math.max(0, Math.min(99, v));
  const clampMinutes = (v: number) => Math.max(0, Math.min(59, v));

  return (
    <div className="entry-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="entry-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="edit-entry-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-entry-title" className="entry-modal__title">Edit Entry</h2>

        {/* Duration input */}
        <div className="entry-modal__field">
          <label className="entry-modal__label">Duration</label>
          <div className="entry-modal__duration-grid">
            <div className="entry-modal__duration-col">
              <button
                type="button"
                className="entry-modal__stepper-btn"
                onClick={() => setHours(clampHours(hours + 1))}
                aria-label="Increase hours"
              >+</button>
              <input
                type="number"
                className="entry-modal__duration-input"
                value={hours}
                onChange={(e) => setHours(clampHours(parseInt(e.target.value) || 0))}
                min={0}
                max={99}
                aria-label="Hours"
              />
              <button
                type="button"
                className="entry-modal__stepper-btn"
                onClick={() => setHours(clampHours(hours - 1))}
                aria-label="Decrease hours"
              >-</button>
              <span className="entry-modal__duration-unit">hrs</span>
            </div>
            <div className="entry-modal__duration-col">
              <button
                type="button"
                className="entry-modal__stepper-btn"
                onClick={() => setMinutes(clampMinutes(minutes + 5))}
                aria-label="Increase minutes"
              >+</button>
              <input
                type="number"
                className="entry-modal__duration-input"
                value={minutes}
                onChange={(e) => setMinutes(clampMinutes(parseInt(e.target.value) || 0))}
                min={0}
                max={59}
                aria-label="Minutes"
              />
              <button
                type="button"
                className="entry-modal__stepper-btn"
                onClick={() => setMinutes(clampMinutes(minutes - 5))}
                aria-label="Decrease minutes"
              >-</button>
              <span className="entry-modal__duration-unit">min</span>
            </div>
          </div>
        </div>

        {/* Workers stepper */}
        <div className="entry-modal__field">
          <label className="entry-modal__label">Workers</label>
          <WorkersStepper value={workers} onChange={setWorkers} size="large" />
        </div>

        {/* Person-hours display */}
        {workers > 1 && (
          <div className="entry-modal__person-hours">
            Person-hours: {formatDurationShort(personMs)}
          </div>
        )}

        {/* Actions */}
        <div className="entry-modal__actions">
          <button
            type="button"
            className={`entry-modal__btn entry-modal__btn--delete ${showDeleteConfirm ? 'entry-modal__btn--delete-confirm' : ''}`}
            onClick={handleDelete}
          >
            <TrashIcon className="entry-modal__btn-icon" />
            {showDeleteConfirm ? 'Confirm delete?' : 'Delete'}
          </button>
          <div className="entry-modal__actions-right">
            <button
              type="button"
              className="entry-modal__btn entry-modal__btn--cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              ref={saveBtnRef}
              type="button"
              className="entry-modal__btn entry-modal__btn--save"
              onClick={handleSave}
              disabled={totalMs <= 0}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
