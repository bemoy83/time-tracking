import type { BuildPhase } from '../../types';

export type PhaseDateField =
  | 'buildUpStartDate'
  | 'buildUpEndDate'
  | 'tearDownStartDate'
  | 'tearDownEndDate';

export interface PhaseDateValues {
  buildUpStartDate: string | null;
  buildUpEndDate: string | null;
  tearDownStartDate: string | null;
  tearDownEndDate: string | null;
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
  'buildUpStartDate',
  'buildUpEndDate',
  'tearDownStartDate',
  'tearDownEndDate',
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
    buildUpStartDate: source?.buildUpStartDate ?? null,
    buildUpEndDate: source?.buildUpEndDate ?? null,
    tearDownStartDate: source?.tearDownStartDate ?? null,
    tearDownEndDate: source?.tearDownEndDate ?? null,
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
  if (phase === 'build-up') {
    return isFilledDate(normalized.buildUpStartDate) && isFilledDate(normalized.buildUpEndDate);
  }
  return isFilledDate(normalized.tearDownStartDate) && isFilledDate(normalized.tearDownEndDate);
}

export function isDateWithinSpan(date: string, span: DateSpan | null): boolean {
  if (!span) return false;
  return date >= span.start && date <= span.end;
}

export function getPhaseSpan(values: Partial<PhaseDateValues> | null | undefined, phase: BuildPhase): DateSpan | null {
  const normalized = readPhaseDateValues(values);
  if (!hasPhaseDatesFor(normalized, phase)) return null;

  if (phase === 'build-up') {
    return {
      start: normalized.buildUpStartDate!,
      end: normalized.buildUpEndDate!,
    };
  }

  return {
    start: normalized.tearDownStartDate!,
    end: normalized.tearDownEndDate!,
  };
}

export function getPlanEffectiveSpan(
  values: (Partial<PhaseDateValues> & Partial<EventDateValues>) | null | undefined,
): DateSpan | null {
  const normalizedPhaseDates = readPhaseDateValues(values);
  if (hasPhaseDates(normalizedPhaseDates)) {
    const complete = normalizedPhaseDates as CompletePhaseDateValues;
    return {
      start: complete.buildUpStartDate,
      end: complete.tearDownEndDate,
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
 * Returns a schedule range when at least one phase has dates (or event dates).
 * Used for work calendar so it renders with build-up only, tear-down only, or both.
 */
export function getScheduleRangeForWorkCalendar(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): PrimaryScheduleRange | null {
  if (hasPhaseDates(phaseDates)) {
    const complete = phaseDates as CompletePhaseDateValues;
    return {
      start: complete.buildUpStartDate,
      end: complete.tearDownEndDate,
      source: 'phase',
    };
  }
  if (hasPhaseDatesFor(phaseDates, 'build-up')) {
    return {
      start: phaseDates.buildUpStartDate!,
      end: phaseDates.buildUpEndDate!,
      source: 'phase',
    };
  }
  if (hasPhaseDatesFor(phaseDates, 'tear-down')) {
    return {
      start: phaseDates.tearDownStartDate!,
      end: phaseDates.tearDownEndDate!,
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

export function getPrimaryScheduleRange(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): PrimaryScheduleRange | null {
  if (hasPhaseDates(phaseDates)) {
    const complete = phaseDates as CompletePhaseDateValues;
    return {
      start: complete.buildUpStartDate,
      end: complete.tearDownEndDate,
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


/**
 * Returns a schedule range when at least one phase has dates (or event dates).
 * Used for work calendar so it renders with build-up only, tear-down only, or both.
 */

/**
 * Returns a schedule range when at least one phase has dates (or event dates).
 * Used for work calendar so it renders with build-up only, tear-down only, or both.
 */

/** Returns a schedule range when at least one phase has dates. Used for work calendar (does not require all four). */

/** Returns a schedule range when at least one phase has dates. Used for work calendar (does not require all four). */

/** Returns a schedule range when at least one phase has dates. Used for work calendar (does not require all four). */

/** Returns a schedule range when at least one phase has dates. Used for work calendar (does not require all four). */

export function getScheduleDateValidationErrors(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): string[] {
  const errors: string[] = [];

  const completePhaseDates = hasPhaseDates(phaseDates)
    ? (phaseDates as CompletePhaseDateValues)
    : null;

  if (completePhaseDates && completePhaseDates.buildUpEndDate >= completePhaseDates.tearDownStartDate) {
    errors.push('Build-up end must be before tear-down start.');
  }

  if (completePhaseDates && isFilledDate(eventStartDate) && completePhaseDates.buildUpEndDate >= eventStartDate) {
    errors.push('Event start must be after build-up end.');
  }

  if (completePhaseDates && isFilledDate(eventEndDate) && eventEndDate >= completePhaseDates.tearDownStartDate) {
    errors.push('Event end must be before tear-down start.');
  }

  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate) && eventStartDate > eventEndDate) {
    errors.push('Event start must be on or before event end.');
  }

  return errors;
}
