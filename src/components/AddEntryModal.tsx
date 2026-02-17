/**
 * AddEntryModal component.
 * Thin wrapper around DurationEditorModal for manually logging time entries.
 */

import { DurationEditorModal } from './DurationEditorModal';

interface AddEntryModalProps {
  isOpen: boolean;
  initialWorkers?: number;
  onSave: (durationMs: number, workers: number) => void;
  onClose: () => void;
}

export function AddEntryModal({ isOpen, initialWorkers, onSave, onClose }: AddEntryModalProps) {
  const handleSave = (hours: number, minutes: number, workers?: number) => {
    const totalMs = hours * 3600000 + minutes * 60000;
    onSave(totalMs, workers ?? 1);
  };

  return (
    <DurationEditorModal
      isOpen={isOpen}
      title="Log Time"
      initialHours={0}
      initialMinutes={0}
      showWorkers
      initialWorkers={initialWorkers ?? 1}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
