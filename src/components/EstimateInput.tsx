/**
 * EstimateInput modal component.
 * Thin wrapper around DurationEditorModal for setting/editing a task's time estimate.
 */

import { DurationEditorModal } from './DurationEditorModal';

interface EstimateInputProps {
  isOpen: boolean;
  currentEstimate: number | null; // in minutes
  onSave: (estimateMinutes: number | null) => void;
  onClose: () => void;
}

export function EstimateInput({ isOpen, currentEstimate, onSave, onClose }: EstimateInputProps) {
  const initialHours = currentEstimate !== null && currentEstimate > 0
    ? Math.floor(currentEstimate / 60)
    : 0;
  const initialMinutes = currentEstimate !== null && currentEstimate > 0
    ? currentEstimate % 60
    : 0;

  const handleSave = (hours: number, minutes: number) => {
    const totalMinutes = hours * 60 + minutes;
    onSave(totalMinutes > 0 ? totalMinutes : null);
  };

  return (
    <DurationEditorModal
      isOpen={isOpen}
      title="Set Estimate"
      initialHours={initialHours}
      initialMinutes={initialMinutes}
      durationLabel="Time Budget"
      showClear={currentEstimate !== null}
      onSave={handleSave}
      onClear={() => onSave(null)}
      onClose={onClose}
    />
  );
}
