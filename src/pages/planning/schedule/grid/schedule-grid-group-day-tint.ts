import type { CSSProperties } from 'react';
import type { DateSpan, PhaseDateValues } from '../../../../lib/planning/scheduling/schedule-span';
import { classifyDayZone } from '../schedule-date-ui';

export interface GroupDayTint {
  className: string;
  style?: CSSProperties;
}

const IN_RANGE = ' schedule-grid__phase-spacer--in-range';
const IN_EXTENDED = ' schedule-grid__phase-spacer--in-extended';

/** Commercial + extended band tint for a build-phase group header day cell. */
export function getPhaseGroupDayTint(
  date: string,
  commercialRange: DateSpan | null,
  extendedRange: DateSpan | null,
): GroupDayTint {
  const inCommercial = commercialRange != null
    && date >= commercialRange.start
    && date <= commercialRange.end;
  const inExtended = !inCommercial
    && extendedRange != null
    && date >= extendedRange.start
    && date <= extendedRange.end;
  return {
    className: `schedule-grid__group-day${inCommercial ? IN_RANGE : ''}${inExtended ? IN_EXTENDED : ''}`,
  };
}

export interface EventGroupDayTintInput {
  isEventCollapsed: boolean;
  phaseDates: PhaseDateValues;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventDateRange: DateSpan | null;
}

/** Zone / event-span tint for the single-plan event group header day cell. */
export function getEventGroupDayTint(date: string, input: EventGroupDayTintInput): GroupDayTint {
  const {
    isEventCollapsed,
    phaseDates,
    eventStartDate,
    eventEndDate,
    eventDateRange,
  } = input;

  if (isEventCollapsed) {
    const zone = classifyDayZone(date, phaseDates, eventStartDate ?? null, eventEndDate ?? null);
    let rangeClass = '';
    let bgVar: string | undefined;
    if (zone === 'assembly' || zone === 'event' || zone === 'dismantle') {
      rangeClass = IN_RANGE;
    } else if (zone === 'moving-in' || zone === 'moving-out') {
      rangeClass = IN_EXTENDED;
    }
    // Event zone uses header --phase-header-spacer-bg (project accent band or default event tint).
    if (zone === 'assembly' || zone === 'moving-in') {
      bgVar = 'var(--wp-phase-assembly-header-bg)';
    } else if (zone === 'dismantle' || zone === 'moving-out') {
      bgVar = 'var(--wp-phase-dismantle-header-bg)';
    }
    return {
      className: `schedule-grid__group-day${rangeClass}`,
      style: bgVar ? { '--phase-header-spacer-bg': bgVar } as CSSProperties : undefined,
    };
  }

  const inEvent = eventDateRange != null
    && date >= eventDateRange.start
    && date <= eventDateRange.end;
  return {
    className: `schedule-grid__group-day${inEvent ? IN_RANGE : ''}`,
  };
}
