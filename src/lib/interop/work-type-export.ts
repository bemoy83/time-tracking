import type { WorkType } from '../types';
import { workTypeKeyString } from '../types';
import { csvRow } from './csv-utils';

/**
 * Export WorkType definitions to CSV.
 * Columns: mappingKey, title, workUnit, assemblyRate, dismantleRate
 */
export function exportWorkTypesCsv(workTypes: WorkType[]): string {
  const headers = ['mappingKey', 'title', 'workUnit', 'assemblyRate', 'dismantleRate'];
  const rows = workTypes.map((workType) =>
    csvRow([
      workTypeKeyString(workType.title, workType.workUnit),
      workType.title,
      workType.workUnit,
      workType.assemblyRate,
      workType.dismantleRate,
    ]),
  );

  return [csvRow(headers), ...rows].join('\n');
}
