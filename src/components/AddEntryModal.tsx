/**
 * AddEntryModal component.
 * Modal for manually logging a time entry after the fact.
 */

import { useState, useRef } from 'react';
import { formatDurationShort } from '../lib/types';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WorkersStepper } from './WorkersStepper';

interface AddEntryModalProps {
  isOpen: boolean;
  onSave: (durationMs: number, workers: number) => void;
  onClose: () => void;
}

export function AddEntryModal({ isOpen, onSave, onClose }: AddEntryModalProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [workers, setWorkers] = useState(1);

  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, saveBtnRef);

  if (!isOpen) return null;

  const totalMs = hours * 3600000 + minutes * 60000;
  const personMs = totalMs * workers;

  const handleSave = () => {
    if (totalMs <= 0) return;
    onSave(totalMs, workers);
    // Reset for next use
    setHours(0);
    setMinutes(0);
    setWorkers(1);
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
        aria-labelledby="add-entry-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-entry-title" className="entry-modal__title">Log Time</h2>

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
        {workers > 1 && totalMs > 0 && (
          <div className="entry-modal__person-hours">
            Person-hours: {formatDurationShort(personMs)}
          </div>
        )}

        {/* Actions */}
        <div className="entry-modal__actions">
          <div className="entry-modal__actions-right entry-modal__actions-right--full">
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
