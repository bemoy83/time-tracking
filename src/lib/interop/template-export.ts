import type { TaskTemplate } from '../types';
import { csvRow } from './csv-utils';

/**
 * Export template definitions to CSV using the work package import column contract.
 */
export function exportTemplatesCsv(
  templates: TaskTemplate[],
  workTypeTitleById: Map<string, string>,
): string {
  const headers = [
    'title',
    'workTypeTitle',
    'workUnit',
    'phase',
    'workQuantity',
    'estimatedMinutes',
    'defaultWorkers',
    'targetProductivity',
  ];

  const rows = templates.map((template) =>
    csvRow([
      template.title,
      template.workTypeId ? (workTypeTitleById.get(template.workTypeId) ?? '') : '',
      template.workUnit,
      template.phase,
      template.workQuantity,
      template.estimatedMinutes,
      template.crew,
      template.targetProductivity,
    ]),
  );

  return [csvRow(headers), ...rows].join('\n');
}
