/**
 * TimeEntryRow component.
 * Two-line row displaying a single time entry.
 * Line 1: date + time of day (left), duration (right).
 * Line 2: source label + optional workers (left), person-hours (right).
 */

import { TimeEntry, TimerSource, durationMs, formatDurationShort, formatPersonHours } from '../lib/types';
import { formatUiDate } from '../lib/utils/formatUiDate';

const SOURCE_LABELS: Record<TimerSource, string> = {
  manual: 'Timer',
  resumed: 'Timer',
  logged: 'Logged',
};

interface TimeEntryRowProps {
  entry: TimeEntry;
  onTap: (entry: TimeEntry) => void;
}

export function TimeEntryRow({ entry, onTap }: TimeEntryRowProps) {
  const dur = durationMs(entry.startUtc, entry.endUtc);
  const workers = entry.workers ?? 1;
  const dateStr = formatUiDate(entry.startUtc, 'short');
  const timeStr = formatUiDate(entry.startUtc, 'time');

  return (
    <button
      type="button"
      className="time-entry-row"
      data-source={entry.source}
      onClick={() => onTap(entry)}
    >
      <span className="time-entry-row__line1">
        <span className="time-entry-row__date">{dateStr} · {timeStr}</span>
        <span className="time-entry-row__duration">{formatDurationShort(dur)}</span>
      </span>
      <span className="time-entry-row__line2">
        <span className="time-entry-row__source">
          {SOURCE_LABELS[entry.source]}
          {workers > 1 && <> · {workers} workers</>}
        </span>
        {workers > 1 && (
          <span className="time-entry-row__person-hours">
            {formatPersonHours(dur, workers)} p-h
          </span>
        )}
      </span>
    </button>
  );
}
