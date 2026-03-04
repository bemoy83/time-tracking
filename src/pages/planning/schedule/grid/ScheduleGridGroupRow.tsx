import { ChevronIcon } from '../../../../components/icons';
import type { GroupRowRenderInput } from './schedule-grid-types';

export function ScheduleGridGroupRow({
  row,
  calendar,
  gridColumns,
  aggregateByDate,
  isCollapsed,
  onToggle,
}: GroupRowRenderInput) {
  return (
    <div className={`schedule-grid__${row.type}-group`}>
      <button
        type="button"
        className={`schedule-grid__phase-header schedule-grid__phase-header--${row.type}`}
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        style={{ gridTemplateColumns: gridColumns }}
      >
        <span className={`schedule-grid__phase-label schedule-grid__phase-label--depth-${row.depth}`}>
          <ChevronIcon
            className={`schedule-grid__phase-chevron${!isCollapsed ? ' schedule-grid__phase-chevron--expanded' : ''}`}
          />
          {row.label}
          {'itemCount' in row && (
            <span className="schedule-grid__group-count">({row.itemCount})</span>
          )}
          {row.readOnly && <span className="schedule-grid__readonly-badge">Read-only</span>}
        </span>
        {calendar.map((day) => {
          const aggregate = aggregateByDate?.get(day.date);
          return (
            <span key={day.date} className="schedule-grid__group-day" aria-hidden="true">
              {aggregate && (aggregate.requiredHours > 0 || aggregate.assignedCrew > 0) && (
                <>
                  <span className="schedule-grid__group-day-hours">{aggregate.requiredHours.toFixed(1)}h</span>
                  {day.isWorkDay && aggregate.assignedCrew > 0 && (
                    <span className="schedule-grid__group-day-crew">
                      {aggregate.assignedCrew.toFixed(0)} crew
                    </span>
                  )}
                </>
              )}
            </span>
          );
        })}
      </button>
    </div>
  );
}
