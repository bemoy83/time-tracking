import type { BuildPhase } from '../../types';

export type PhaseDateField =
  | 'assemblyStartDate'
  | 'assemblyEndDate'
  | 'dismantleStartDate'
  | 'dismantleEndDate';

export interface PhaseDateValues {
  assemblyStartDate: string | null;
  assemblyEndDate: string | null;
  dismantleStartDate: string | null;
  dismantleEndDate: string | null;
}

type CompletePhaseDateValues = {
  [K in keyof PhaseDateValues]: string;
};

export interface DateSpan {
  start: string;
  end: string;
}

export interface PrimaryScheduleRange extends DateSpan {
  source: 'phase' | 'event';
}

const PHASE_FIELDS: PhaseDateField[] = [
  'assemblyStartDate',
  'assemblyEndDate',
  'dismantleStartDate',
  'dismantleEndDate',
];

interface EventDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
}

function isFilledDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function readPhaseDateValues(source: Partial<PhaseDateValues> | null | undefined): PhaseDateValues {
  return {
    assemblyStartDate: source?.assemblyStartDate ?? null,
    assemblyEndDate: source?.assemblyEndDate ?? null,
    dismantleStartDate: source?.dismantleStartDate ?? null,
    dismantleEndDate: source?.dismantleEndDate ?? null,
  };
}

export function hasAnyPhaseDates(values: PhaseDateValues): boolean {
  return PHASE_FIELDS.some((field) => isFilledDate(values[field]));
}

export function hasPhaseDates(
  values: Partial<PhaseDateValues> | null | undefined,
): values is CompletePhaseDateValues {
  const normalized = readPhaseDateValues(values);
  return PHASE_FIELDS.every((field) => isFilledDate(normalized[field]));
}

export function hasCompletePhaseDates(values: PhaseDateValues): values is CompletePhaseDateValues {
  return hasPhaseDates(values);
}

/** True when the given phase has both start and end dates. Used for phase-specific logic (work day count, span). */
export function hasPhaseDatesFor(
  values: Partial<PhaseDateValues> | null | undefined,
  phase: BuildPhase,
): boolean {
  const normalized = readPhaseDateValues(values);
  if (phase === 'assembly') {
    return isFilledDate(normalized.assemblyStartDate) && isFilledDate(normalized.assemblyEndDate);
  }
  return isFilledDate(normalized.dismantleStartDate) && isFilledDate(normalized.dismantleEndDate);
}

export function isDateWithinSpan(date: string, span: DateSpan | null): boolean {
  if (!span) return false;
  return date >= span.start && date <= span.end;
}

export function getPhaseSpan(values: Partial<PhaseDateValues> | null | undefined, phase: BuildPhase): DateSpan | null {
  const normalized = readPhaseDateValues(values);
  if (!hasPhaseDatesFor(normalized, phase)) return null;

  if (phase === 'assembly') {
    return {
      start: normalized.assemblyStartDate!,
      end: normalized.assemblyEndDate!,
    };
  }

  return {
    start: normalized.dismantleStartDate!,
    end: normalized.dismantleEndDate!,
  };
}

export function getPlanEffectiveSpan(
  values: (Partial<PhaseDateValues> & Partial<EventDateValues>) | null | undefined,
): DateSpan | null {
  const normalizedPhaseDates = readPhaseDateValues(values);
  if (hasPhaseDates(normalizedPhaseDates)) {
    const complete = normalizedPhaseDates as CompletePhaseDateValues;
    return {
      start: complete.assemblyStartDate,
      end: complete.dismantleEndDate,
    };
  }

  const eventStartDate = values?.eventStartDate ?? null;
  const eventEndDate = values?.eventEndDate ?? null;
  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate)) {
    return {
      start: eventStartDate,
      end: eventEndDate,
    };
  }

  return null;
}

export function getPhaseRange(values: Partial<PhaseDateValues> | null | undefined, phase: BuildPhase): DateSpan | null {
  return getPhaseSpan(values, phase);
}

/**
 * Returns all phase spans that should drive the work calendar.
 * Event dates are intentionally excluded; calendar is phase-only.
 */
export function getWorkCalendarPhaseSpans(
  phaseDates: Partial<PhaseDateValues> | null | undefined,
): DateSpan[] {
  const normalized = readPhaseDateValues(phaseDates);
  const spans: DateSpan[] = [];

  if (hasPhaseDatesFor(normalized, 'assembly')) {
    spans.push({
      start: normalized.assemblyStartDate!,
      end: normalized.assemblyEndDate!,
    });
  }
  if (hasPhaseDatesFor(normalized, 'dismantle')) {
    spans.push({
      start: normalized.dismantleStartDate!,
      end: normalized.dismantleEndDate!,
    });
  }

  return spans.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Returns a summary range for the work calendar when phase dates exist.
 * Event dates are intentionally excluded; calendar is phase-only.
 */
export function getScheduleRangeForWorkCalendar(
  phaseDates: PhaseDateValues,
  _eventStartDate: string | null,
  _eventEndDate: string | null,
): PrimaryScheduleRange | null {
  const spans = getWorkCalendarPhaseSpans(phaseDates);
  if (spans.length === 0) return null;

  return {
    start: spans[0].start,
    end: spans[spans.length - 1].end,
    source: 'phase',
  };
}

export function isDateWithinAnySpan(date: string, spans: DateSpan[]): boolean {
  for (const span of spans) {
    if (date >= span.start && date <= span.end) return true;
  }
  return false;
}

export function getPrimaryScheduleRange(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): PrimaryScheduleRange | null {
  if (hasPhaseDates(phaseDates)) {
    const complete = phaseDates as CompletePhaseDateValues;
    return {
      start: complete.assemblyStartDate,
      end: complete.dismantleEndDate,
      source: 'phase',
    };
  }

  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate)) {
    return {
      start: eventStartDate,
      end: eventEndDate,
      source: 'event',
    };
  }

  return null;
}

export function getScheduleDateValidationErrors(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): string[] {
  const errors: string[] = [];

  const completePhaseDates = hasPhaseDates(phaseDates)
    ? (phaseDates as CompletePhaseDateValues)
    : null;

  if (completePhaseDates && completePhaseDates.assemblyEndDate >= completePhaseDates.dismantleStartDate) {
    errors.push('Assembly end must be before dismantle start.');
  }

  if (completePhaseDates && isFilledDate(eventStartDate) && completePhaseDates.assemblyEndDate >= eventStartDate) {
    errors.push('Event start must be after assembly end.');
  }

  if (completePhaseDates && isFilledDate(eventEndDate) && eventEndDate >= completePhaseDates.dismantleStartDate) {
    errors.push('Event end must be before dismantle start.');
  }

  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate) && eventStartDate > eventEndDate) {
    errors.push('Event start must be on or before event end.');
  }

  return errors;
}
