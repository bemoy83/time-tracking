import type { ProjectPhaseDates } from '../types';
import { getScheduleDateValidationErrors } from '../planning/scheduling/schedule-span';

export type ProjectPhaseDateField = keyof ProjectPhaseDates;

export function normalizeProjectPhaseDates(
  dates?: Partial<ProjectPhaseDates> | null,
): ProjectPhaseDates {
  return {
    assemblyStartDate: dates?.assemblyStartDate ?? null,
    assemblyEndDate: dates?.assemblyEndDate ?? null,
    dismantleStartDate: dates?.dismantleStartDate ?? null,
    dismantleEndDate: dates?.dismantleEndDate ?? null,
    eventStartDate: dates?.eventStartDate ?? null,
    eventEndDate: dates?.eventEndDate ?? null,
  };
}

export function isIsoDateOnly(value: string | null | undefined): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasCompleteRange(start: string | null, end: string | null): boolean {
  return Boolean(start && end);
}

export function hasProjectImportablePhaseDates(dates: ProjectPhaseDates): boolean {
  return (
    hasCompleteRange(dates.assemblyStartDate, dates.assemblyEndDate) ||
    hasCompleteRange(dates.dismantleStartDate, dates.dismantleEndDate)
  );
}

export function getProjectPhaseDateValidationErrors(dates: ProjectPhaseDates): string[] {
  const errors: string[] = [];
  const rangeFields: Array<[label: string, string | null, string | null]> = [
    ['Assembly', dates.assemblyStartDate, dates.assemblyEndDate],
    ['Dismantle', dates.dismantleStartDate, dates.dismantleEndDate],
    ['Event', dates.eventStartDate, dates.eventEndDate],
  ];

  for (const [label, start, end] of rangeFields) {
    if (start && !isIsoDateOnly(start)) {
      errors.push(`${label} start must use YYYY-MM-DD.`);
    }
    if (end && !isIsoDateOnly(end)) {
      errors.push(`${label} end must use YYYY-MM-DD.`);
    }
    if (start && end && start > end) {
      errors.push(`${label} start must be on or before ${label.toLowerCase()} end.`);
    }
  }

  errors.push(
    ...getScheduleDateValidationErrors(dates, dates.eventStartDate, dates.eventEndDate),
  );

  return Array.from(new Set(errors));
}
