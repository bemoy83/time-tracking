/**
 * EditEntryModal component.
 * Thin wrapper around DurationEditorModal for editing time entries.
 * Supports delete with two-step confirmation (handled inside DurationEditorModal).
 */

import { TimeEntry, durationMs, formatDurationShort } from '../lib/types';
import { DurationEditorModal } from './DurationEditorModal';

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

  const handleSave = (hours: number, minutes: number, workers?: number) => {
    const totalMs = hours * 3600000 + minutes * 60000;
    onSave({ durationMs: totalMs, workers: workers ?? 1 });
  };

  const personMs = dur * (entry.workers ?? 1);

  return (
    <DurationEditorModal
      isOpen={isOpen}
      title="Edit Entry"
      initialHours={initialHours}
      initialMinutes={initialMinutes}
      showWorkers
      initialWorkers={entry.workers ?? 1}
      showDelete
      onSave={handleSave}
      onDelete={() => onDelete(entry.id)}
      onClose={onClose}
      preview={
        (entry.workers ?? 1) > 1 ? (
          <div className="entry-modal__person-hours">
            Person-hours: {formatDurationShort(personMs)}
          </div>
        ) : undefined
      }
    />
  );
}
