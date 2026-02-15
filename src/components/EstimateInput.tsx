/**
 * EstimateInput modal component.
 * Modal for setting/editing a task's time estimate.
 * Reuses the stepper pattern from AddEntryModal.
 */

import { useState, useEffect, useRef } from 'react';
import { formatDurationShort } from '../lib/types';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';

interface EstimateInputProps {
  isOpen: boolean;
  currentEstimate: number | null; // in minutes
  onSave: (estimateMinutes: number | null) => void;
  onClose: () => void;
}

export function EstimateInput({ isOpen, currentEstimate, onSave, onClose }: EstimateInputProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, saveBtnRef);

  useEffect(() => {
    if (isOpen) {
      if (currentEstimate !== null && currentEstimate > 0) {
        setHours(Math.floor(currentEstimate / 60));
        setMinutes(currentEstimate % 60);
      } else {
        setHours(0);
        setMinutes(0);
      }
    }
  }, [isOpen, currentEstimate]);

  if (!isOpen) return null;

  const totalMinutes = hours * 60 + minutes;
  const totalMs = totalMinutes * 60_000;

  const clampHours = (v: number) => Math.max(0, Math.min(99, v));
  const clampMinutes = (v: number) => Math.max(0, Math.min(59, v));

  const handleSave = () => {
    onSave(totalMinutes > 0 ? totalMinutes : null);
  };

  const handleClear = () => {
    onSave(null);
  };

  return (
    <div className="entry-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="entry-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="estimate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="estimate-title" className="entry-modal__title">Set Estimate</h2>

        {/* Duration input */}
        <div className="entry-modal__field">
          <label className="entry-modal__label">Time Budget</label>
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

        {/* Preview */}
        {totalMinutes > 0 && (
          <div className="entry-modal__person-hours">
            Estimate: {formatDurationShort(totalMs)}
          </div>
        )}

        {/* Actions */}
        <div className="entry-modal__actions">
          <div className="entry-modal__actions-right entry-modal__actions-right--full">
            {currentEstimate !== null && (
              <button
                type="button"
                className="entry-modal__btn entry-modal__btn--delete"
                onClick={handleClear}
              >
                Clear
              </button>
            )}
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
              disabled={totalMinutes <= 0}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
