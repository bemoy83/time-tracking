import type { Project } from '../types';
import { normalizeProjectName } from '../types';
import { csvRow } from './csv-utils';

const PROJECT_EXPORT_HEADERS = [
  'mappingKey',
  'name',
  'assemblyStartDate',
  'assemblyEndDate',
  'dismantleStartDate',
  'dismantleEndDate',
  'eventStartDate',
  'eventEndDate',
];

export function exportProjectsCsv(projects: Project[]): string {
  const rows = projects.map((project) =>
    csvRow([
      normalizeProjectName(project.name),
      project.name,
      project.assemblyStartDate,
      project.assemblyEndDate,
      project.dismantleStartDate,
      project.dismantleEndDate,
      project.eventStartDate,
      project.eventEndDate,
    ]),
  );

  return [csvRow(PROJECT_EXPORT_HEADERS), ...rows].join('\n');
}

export function exportProjectCsvSample(): string {
  return [
    csvRow(PROJECT_EXPORT_HEADERS),
    csvRow([
      'spring expo 2026',
      'Spring Expo 2026',
      '2026-05-01',
      '2026-05-03',
      '2026-05-08',
      '2026-05-09',
      '2026-05-05',
      '2026-05-07',
    ]),
  ].join('\n');
}
