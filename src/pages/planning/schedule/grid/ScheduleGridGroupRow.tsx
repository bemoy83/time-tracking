import { ChevronIcon } from '../../../../components/icons';
import type { SharedSchedulePhaseRow } from '../../../../lib/planning/scheduling/shared-schedule-types';
import type { GroupRowRenderInput } from './schedule-grid-types';

export function ScheduleGridGroupRow({
  row,
  calendar,
  gridColumns: _gridColumns,
  aggregateByDate,
  isCollapsed,
  onToggle,
}: GroupRowRenderInput) {
  const phaseMod = row.type === 'phase' ? ` schedule-grid__phase-header--${(row as SharedSchedulePhaseRow).phase}` : '';
  return (
    <div className={`schedule-grid__${row.type}-group`}>
      <button
        type="button"
        className={`schedule-grid__phase-header schedule-grid__phase-header--${row.type}${phaseMod}`}
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <span className="schedule-grid__sticky-cell">
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
        </span>
        {calendar.map((day) => {
          const aggregate = aggregateByDate?.get(day.date);
          return (
            <span key={day.date} className="schedule-grid__group-day" aria-hidden="true">
              {aggregate && (aggregate.requiredHours + aggregate.shortfallHours > 0 || aggregate.assignedCapacityHours > 0) && (
                <>
                  <span className="schedule-grid__group-day-hours">
                    {(() => {
                      const allocated = aggregate.assignedCapacityHours;
                      const required = aggregate.requiredHours + aggregate.shortfallHours;
                      if (required <= 0) return allocated > 0 ? `${allocated.toFixed(0)}h` : null;
                      if (allocated <= 0) return `${required.toFixed(1)}h needed`;
                      return `${allocated.toFixed(0)} / ${required.toFixed(1)}h`;
                    })()}
                  </span>
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
