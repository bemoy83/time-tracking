import { PencilIcon } from '../../../components/icons';

interface EventContextBarProps {
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
  eventStartDate,
  eventEndDate,
  calendarDayCount,
  defaultCrewSize,
  totalAvailableHours,
  onEdit,
}: EventContextBarProps) {
  if (!eventStartDate || !eventEndDate) return null;

  const dateRange = `${formatDate(eventStartDate)}–${formatDate(eventEndDate)}`;

  return (
    <div className="event-context-bar">
      <span className="event-context-bar__label">Event:</span>
      <span className="event-context-bar__detail">{dateRange}</span>
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{calendarDayCount} {calendarDayCount === 1 ? 'day' : 'days'}</span>
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{defaultCrewSize ?? '–'} crew</span>
      <span className="event-context-bar__separator">&middot;</span>
      <span className="event-context-bar__detail">{totalAvailableHours.toFixed(0)}h available</span>
      <button
        type="button"
        className="event-context-bar__edit"
        onClick={onEdit}
        aria-label="Edit event inputs"
      >
        <PencilIcon className="event-context-bar__edit-icon" />
        Edit
      </button>
    </div>
  );
}
