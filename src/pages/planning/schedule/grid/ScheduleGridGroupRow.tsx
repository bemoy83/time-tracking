import type { CSSProperties } from 'react';
import { ChevronIcon } from '../../../../components/icons';
import type { SharedSchedulePhaseRow } from '../../../../lib/planning/scheduling/shared-schedule-types';
import type { GroupRowRenderInput } from './schedule-grid-types';

export function ScheduleGridGroupRow({
  row,
  calendar,
  gridColumns: _gridColumns,
  aggregateByDate,
  topLevelAccentColor,
  headerVariant,
  itemCountOverride,
  getGroupDayTint,
  isCollapsed,
  onToggle,
}: GroupRowRenderInput) {
  const phaseMod = row.type === 'phase' ? ` schedule-grid__phase-header--${(row as SharedSchedulePhaseRow).phase}` : '';
  const isTopLevel = row.type === 'project' || headerVariant === 'event';
  const topLevelMod = isTopLevel ? ' schedule-grid__phase-header--top-level' : '';
  const headerTypeClass = headerVariant === 'event'
    ? 'schedule-grid__phase-header--event'
    : `schedule-grid__phase-header--${row.type}`;
  const accentStyle = isTopLevel && topLevelAccentColor
    ? { '--schedule-top-group-fg': topLevelAccentColor } as CSSProperties
    : undefined;
  const itemCount = itemCountOverride ?? ('itemCount' in row ? row.itemCount : undefined);
  return (
    <div className={`schedule-grid__${row.type}-group`}>
      <button
        type="button"
        className={`schedule-grid__phase-header ${headerTypeClass}${topLevelMod}${phaseMod}`}
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        style={accentStyle}
      >
        <span className="schedule-grid__sticky-cell">
          <span className={`schedule-grid__phase-label schedule-grid__phase-label--depth-${row.depth}`}>
            <ChevronIcon
              className={`schedule-grid__phase-chevron${!isCollapsed ? ' schedule-grid__phase-chevron--expanded' : ''}`}
            />
            {row.label}
            {itemCount != null && (
              <span className="schedule-grid__group-count">({itemCount})</span>
            )}
            {row.readOnly && <span className="schedule-grid__readonly-badge">Read-only</span>}
          </span>
        </span>
        {calendar.map((day) => {
          const aggregate = aggregateByDate?.get(day.date);
          const tint = getGroupDayTint?.(day) ?? { className: 'schedule-grid__group-day' };
          return (
            <span
              key={day.date}
              className={tint.className}
              style={tint.style}
              aria-hidden="true"
            >
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
