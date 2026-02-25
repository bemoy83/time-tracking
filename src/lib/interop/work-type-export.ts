import type { WorkType } from '../types';
import { workTypeKeyString } from '../types';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | number | null)[]): string {
  return fields
    .map((field) => {
      if (field == null) return '';
      if (typeof field === 'number') return field.toString();
      return csvEscape(field);
    })
    .join(',');
}

/**
 * Export WorkType definitions to CSV.
 * Columns: mappingKey, title, workUnit, buildPhase, expectedProductivity
 */
export function exportWorkTypesCsv(workTypes: WorkType[]): string {
  const headers = ['mappingKey', 'title', 'workUnit', 'buildPhase', 'expectedProductivity'];
  const rows = workTypes.map((workType) =>
    csvRow([
      workTypeKeyString(workType.title, workType.workUnit, workType.buildPhase),
      workType.title,
      workType.workUnit,
      workType.buildPhase,
      workType.expectedProductivity,
    ]),
  );

  return [csvRow(headers), ...rows].join('\n');
}
