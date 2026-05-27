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

// ─── Extended phase / full-span helpers ──────────────────────────────────────

/** Shift an ISO date string by `delta` calendar days (+/-). */
function offsetDate(date: string, delta: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + delta);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The full contiguous event span: assemblyStartDate → dismantleEndDate.
 * Falls back to event-only span if phase dates are absent.
 */
export function getFullEventSpan(
  phaseDates: Partial<PhaseDateValues> | null | undefined,
  eventStartDate: string | null,
  eventEndDate: string | null,
): DateSpan | null {
  const normalized = readPhaseDateValues(phaseDates);
  if (hasPhaseDates(normalized)) {
    const c = normalized as CompletePhaseDateValues;
    return { start: c.assemblyStartDate, end: c.dismantleEndDate };
  }
  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate)) {
    return { start: eventStartDate, end: eventEndDate };
  }
  return null;
}

/**
 * The extended scheduling window for a phase, reaching to the event boundary.
 *
 * Assembly extends to the day before eventStartDate (moving-in window).
 * Dismantle starts the day after eventEndDate (moving-out window).
 * Falls back to the commercial phase dates if event dates are absent.
 */
export function getExtendedPhaseRange(
  phaseDates: Partial<PhaseDateValues> | null | undefined,
  phase: BuildPhase,
  eventStartDate: string | null,
  eventEndDate: string | null,
): DateSpan | null {
  const normalized = readPhaseDateValues(phaseDates);
  if (!hasPhaseDatesFor(normalized, phase)) return null;

  if (phase === 'assembly') {
    const start = normalized.assemblyStartDate!;
    const end = isFilledDate(eventStartDate)
      ? offsetDate(eventStartDate, -1)
      : normalized.assemblyEndDate!;
    // Guard: extended end must be ≥ commercial end (event start already validated upstream)
    return { start, end: end >= normalized.assemblyEndDate! ? end : normalized.assemblyEndDate! };
  }

  // dismantle
  const end = normalized.dismantleEndDate!;
  const start = isFilledDate(eventEndDate)
    ? offsetDate(eventEndDate, 1)
    : normalized.dismantleStartDate!;
  return { start: start <= normalized.dismantleStartDate! ? start : normalized.dismantleStartDate!, end };
}

/** Zone classification for a single date within the full event timeline. */
export type DayZone = 'assembly' | 'moving-in' | 'event' | 'moving-out' | 'dismantle' | 'outside';

export function classifyDayZone(
  date: string,
  phaseDates: Partial<PhaseDateValues> | null | undefined,
  eventStartDate: string | null,
  eventEndDate: string | null,
): DayZone {
  const n = readPhaseDateValues(phaseDates);

  if (hasPhaseDatesFor(n, 'assembly') && date >= n.assemblyStartDate! && date <= n.assemblyEndDate!) {
    return 'assembly';
  }
  if (hasPhaseDatesFor(n, 'dismantle') && date >= n.dismantleStartDate! && date <= n.dismantleEndDate!) {
    return 'dismantle';
  }
  if (isFilledDate(eventStartDate) && isFilledDate(eventEndDate) && date >= eventStartDate && date <= eventEndDate) {
    return 'event';
  }
  // Moving-in: after assembly end, before event start
  if (
    hasPhaseDatesFor(n, 'assembly')
    && isFilledDate(eventStartDate)
    && date > n.assemblyEndDate!
    && date < eventStartDate
  ) {
    return 'moving-in';
  }
  // Moving-out: after event end, before dismantle start
  if (
    hasPhaseDatesFor(n, 'dismantle')
    && isFilledDate(eventEndDate)
    && date > eventEndDate
    && date < n.dismantleStartDate!
  ) {
    return 'moving-out';
  }
  return 'outside';
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
