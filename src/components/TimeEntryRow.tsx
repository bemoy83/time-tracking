/**
 * TimeEntryRow component.
 * Compact row displaying a single time entry.
 * Shows: date, duration, workers badge (if > 1), person-hours (if > 1).
 */

import { TimeEntry, durationMs, formatDurationShort, formatPersonHours } from '../lib/types';

interface TimeEntryRowProps {
  entry: TimeEntry;
  onTap: (entry: TimeEntry) => void;
}

export function TimeEntryRow({ entry, onTap }: TimeEntryRowProps) {
  const dur = durationMs(entry.startUtc, entry.endUtc);
  const workers = entry.workers ?? 1;
  const date = new Date(entry.startUtc);

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      type="button"
      className="time-entry-row"
      onClick={() => onTap(entry)}
    >
      <span className="time-entry-row__date">{dateStr}</span>
      <span className="time-entry-row__duration">{formatDurationShort(dur)}</span>
      {workers > 1 && (
        <>
          <span className="time-entry-row__workers">&times;{workers}</span>
          <span className="time-entry-row__person-hours">
            {formatPersonHours(dur, workers)} person-hrs
          </span>
        </>
      )}
      {entry.source === 'logged' && (
        <span className="time-entry-row__logged-badge">logged</span>
      )}
    </button>
  );
}
