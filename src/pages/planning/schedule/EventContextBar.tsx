import { PencilIcon } from '../../../components/icons';
import { type PhaseDateValues, getPrimaryScheduleRange } from './schedule-date-ui';

interface EventContextBarProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  calendarDayCount: number;
  defaultCrewSize: number | null;
  totalAvailableHours: number;
  onEdit: () => void;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export function EventContextBar({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  calendarDayCount,
  defaultCrewSize,
  totalAvailableHours,
  onEdit,
}: EventContextBarProps) {
  const primaryRange = getPrimaryScheduleRange(
    {
      assemblyStartDate,
      assemblyEndDate,
      dismantleStartDate,
      dismantleEndDate,
    },
    eventStartDate,
    eventEndDate,
  );

  if (!primaryRange) return null;

  const label = primaryRange.source === 'phase' ? 'Schedule:' : 'Event:';
  const dateRange = `${formatDate(primaryRange.start)}-${formatDate(primaryRange.end)}`;
  const hasEventOverlay =
    primaryRange.source === 'phase' &&
    eventStartDate != null &&
    eventEndDate != null;

  return (
    <div className="event-context-bar">
      <span className="event-context-bar__label">{label}</span>
      <span className="event-context-bar__detail event-context-bar__detail--emphasis">{dateRange}</span>
      {hasEventOverlay && (
        <>
          <span className="event-context-bar__separator">&middot;</span>
          <span className="event-context-bar__label event-context-bar__label--secondary">Event:</span>
          <span className="event-context-bar__detail">
            {formatDate(eventStartDate!)}-{formatDate(eventEndDate!)}
          </span>
        </>
      )}
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{calendarDayCount} {calendarDayCount === 1 ? 'day' : 'days'}</span>
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{defaultCrewSize ?? '-'} crew</span>
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{totalAvailableHours.toFixed(0)}h available</span>
      <button
        type="button"
        className="event-context-bar__edit"
        onClick={onEdit}
        aria-label="Edit schedule inputs"
      >
        <PencilIcon className="event-context-bar__edit-icon" />
        Edit
      </button>
    </div>
  );
}
