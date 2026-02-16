/**
 * DurationEditorModal component.
 * Shared duration picker modal used by AddEntryModal, EditEntryModal, and EstimateInput.
 */

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { WorkersStepper } from './WorkersStepper';
import { TrashIcon } from './icons';

interface DurationEditorModalProps {
  isOpen: boolean;
  title: string;
  initialHours: number;
  initialMinutes: number;
  showWorkers?: boolean;
  initialWorkers?: number;
  showDelete?: boolean;
  showClear?: boolean;
  durationLabel?: string;
  preview?: ReactNode;
  onSave: (hours: number, minutes: number, workers?: number) => void;
  onDelete?: () => void;
  onClear?: () => void;
  onClose: () => void;
}

const clampHours = (v: number) => Math.max(0, Math.min(99, v));
const clampMinutes = (v: number) => Math.max(0, Math.min(59, v));

export function DurationEditorModal({
  isOpen,
  title,
  initialHours,
  initialMinutes,
  showWorkers = false,
  initialWorkers = 1,
  showDelete = false,
  showClear = false,
  durationLabel = 'Duration',
  preview,
  onSave,
  onDelete,
  onClear,
  onClose,
}: DurationEditorModalProps) {
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [workers, setWorkers] = useState(initialWorkers);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, saveBtnRef);

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setHours(initialHours);
      setMinutes(initialMinutes);
      setWorkers(initialWorkers);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, initialHours, initialMinutes, initialWorkers]);

  if (!isOpen) return null;

  const totalMs = hours * 3600000 + minutes * 60000;

  const handleSave = () => {
    if (totalMs <= 0) return;
    onSave(hours, minutes, showWorkers ? workers : undefined);
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="entry-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className="entry-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="duration-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="duration-editor-title" className="entry-modal__title">{title}</h2>

        {/* Duration input */}
        <div className="entry-modal__field">
          <label className="entry-modal__label">{durationLabel}</label>
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
        {showWorkers && (
          <div className="entry-modal__field">
            <label className="entry-modal__label">Workers</label>
            <WorkersStepper value={workers} onChange={setWorkers} size="large" />
          </div>
        )}

        {/* Preview */}
        {preview}

        {/* Actions */}
        <div className="entry-modal__actions">
          {showDelete && (
            <button
              type="button"
              className={`btn ${showDeleteConfirm ? 'btn--danger' : 'btn--ghost'}`}
              onClick={handleDelete}
            >
              <TrashIcon className="entry-modal__btn-icon" />
              {showDeleteConfirm ? 'Confirm delete?' : 'Delete'}
            </button>
          )}
          {showClear && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClear}
            >
              Clear
            </button>
          )}
          <div className={`entry-modal__actions-right ${!showDelete && !showClear ? 'entry-modal__actions-right--full' : ''}`}>
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              ref={saveBtnRef}
              type="button"
              className="btn btn--primary btn--lg"
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
