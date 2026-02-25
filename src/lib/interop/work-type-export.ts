import type { WorkType } from '../types';
import { workTypeKeyString } from '../types';
import { csvRow } from './csv-utils';

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
