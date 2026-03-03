import type { BuildPhase } from '../../../lib/types';

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

export function hasCompletePhaseDates(values: PhaseDateValues): boolean {
  return PHASE_FIELDS.every((field) => isFilledDate(values[field]));
}

export function isDateWithinSpan(date: string, span: DateSpan | null): boolean {
  if (!span) return false;
  return date >= span.start && date <= span.end;
}

export function getPhaseRange(values: PhaseDateValues, phase: BuildPhase): DateSpan | null {
  if (!hasCompletePhaseDates(values)) return null;

  if (phase === 'build-up') {
    return {
      start: values.buildUpStartDate!,
      end: values.buildUpEndDate!,
    };
  }

  return {
    start: values.tearDownStartDate!,
    end: values.tearDownEndDate!,
  };
}

export function getPrimaryScheduleRange(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): PrimaryScheduleRange | null {
  if (hasCompletePhaseDates(phaseDates)) {
    return {
      start: phaseDates.buildUpStartDate!,
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

export function getScheduleDateValidationErrors(
  phaseDates: PhaseDateValues,
  eventStartDate: string | null,
  eventEndDate: string | null,
): string[] {
  const errors: string[] = [];

  const hasAllPhaseDates = hasCompletePhaseDates(phaseDates);

  if (hasAllPhaseDates && phaseDates.buildUpEndDate! >= phaseDates.tearDownStartDate!) {
    errors.push('Build-up end must be before tear-down start.');
  }

  if (hasAllPhaseDates && isFilledDate(eventStartDate) && phaseDates.buildUpEndDate! >= eventStartDate) {
    errors.push('Event start must be after build-up end.');
  }

  if (hasAllPhaseDates && isFilledDate(eventEndDate) && eventEndDate >= phaseDates.tearDownStartDate!) {
    errors.push('Event end must be before tear-down start.');
  }

  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate) && eventStartDate > eventEndDate) {
    errors.push('Event start must be on or before event end.');
  }

  return errors;
}
