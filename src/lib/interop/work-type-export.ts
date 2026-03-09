import type { WorkType } from '../types';
import { workTypeKeyString } from '../types';
import { csvRow } from './csv-utils';

/**
 * Export WorkType definitions to CSV.
 * Columns: mappingKey, title, workUnit, buildUpRate, tearDownRate
 */
export function exportWorkTypesCsv(workTypes: WorkType[]): string {
  const headers = ['mappingKey', 'title', 'workUnit', 'buildUpRate', 'tearDownRate'];
  const rows = workTypes.map((workType) =>
    csvRow([
      workTypeKeyString(workType.title, workType.workUnit),
      workType.title,
      workType.workUnit,
      workType.buildUpRate,
      workType.tearDownRate,
    ]),
  );

  return [csvRow(headers), ...rows].join('\n');
}
