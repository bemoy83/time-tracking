import type { Project } from '../types';
import type { ProjectPhaseDates } from '../types';
import { normalizeProjectName } from '../types';
import {
  createProject,
  findProjectByName,
  updateProjectPhaseDates,
} from '../stores/task-store';
import {
  getProjectPhaseDateValidationErrors,
  isIsoDateOnly,
  normalizeProjectPhaseDates,
} from '../projects/project-phase-dates';
import { detectCsvDelimiter, parseCsvLine } from './csv-utils';

export interface ImportedProject extends ProjectPhaseDates {
  mappingKey: string;
  name: string;
}

export interface ProjectImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ProjectImportParseResult {
  items: ImportedProject[];
  errors: ProjectImportValidationError[];
  valid: boolean;
}

export type ProjectImportAction = 'create' | 'update';

export interface ProjectImportPreviewItem {
  action: ProjectImportAction;
  item: ImportedProject;
  existingId: string | null;
}

export interface ProjectImportPreview {
  items: ProjectImportPreviewItem[];
  summary: {
    create: number;
    update: number;
  };
  duplicateKeys: string[];
}

const REQUIRED_HEADER = 'name';
const OPTIONAL_DATE_HEADERS = [
  'assemblystartdate',
  'assemblyenddate',
  'dismantlestartdate',
  'dismantleenddate',
  'eventstartdate',
  'eventenddate',
] as const;
const PROJECT_HEADER_ALIASES: Record<string, string> = {
  'name': 'name',
  'event name': 'name',
  'assemblystartdate': 'assemblystartdate',
  'assembly start date': 'assemblystartdate',
  'assemblyenddate': 'assemblyenddate',
  'assembly end date': 'assemblyenddate',
  'dismantlestartdate': 'dismantlestartdate',
  'dismantle start date': 'dismantlestartdate',
  'dismantleenddate': 'dismantleenddate',
  'dismantle end date': 'dismantleenddate',
  'eventstartdate': 'eventstartdate',
  'event start date': 'eventstartdate',
  'eventenddate': 'eventenddate',
  'event end date': 'eventenddate',
};

function normalizeProjectHeader(header: string): string {
  const normalized = header.trim().toLowerCase();
  return PROJECT_HEADER_ALIASES[normalized] ?? normalized.replace(/\s+/g, '');
}

function readDateField(row: Record<string, string>, key: typeof OPTIONAL_DATE_HEADERS[number]): string | null {
  const value = row[key]?.trim() ?? '';
  return value === '' ? null : value;
}

export function parseProjectCsv(csvText: string): ProjectImportParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      items: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV must have a header row and at least one data row' }],
      valid: false,
    };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeProjectHeader);
  if (!headers.includes(REQUIRED_HEADER)) {
    return {
      items: [],
      errors: [{ row: 0, field: 'headers', message: 'Missing required header: name' }],
      valid: false,
    };
  }

  const items: ImportedProject[] = [];
  const errors: ProjectImportValidationError[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const fields = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = (fields[headerIndex] ?? '').trim();
    });

    const rowNum = index + 1;
    const name = row.name?.trim() ?? '';
    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      continue;
    }

    const phaseDates = normalizeProjectPhaseDates({
      assemblyStartDate: readDateField(row, 'assemblystartdate'),
      assemblyEndDate: readDateField(row, 'assemblyenddate'),
      dismantleStartDate: readDateField(row, 'dismantlestartdate'),
      dismantleEndDate: readDateField(row, 'dismantleenddate'),
      eventStartDate: readDateField(row, 'eventstartdate'),
      eventEndDate: readDateField(row, 'eventenddate'),
    });

    const dateFieldMap: Array<[keyof ProjectPhaseDates, string]> = [
      ['assemblyStartDate', 'assemblyStartDate'],
      ['assemblyEndDate', 'assemblyEndDate'],
      ['dismantleStartDate', 'dismantleStartDate'],
      ['dismantleEndDate', 'dismantleEndDate'],
      ['eventStartDate', 'eventStartDate'],
      ['eventEndDate', 'eventEndDate'],
    ];
    for (const [field, label] of dateFieldMap) {
      if (!isIsoDateOnly(phaseDates[field])) {
        errors.push({ row: rowNum, field: label, message: 'Must use YYYY-MM-DD' });
      }
    }

    const validationErrors = getProjectPhaseDateValidationErrors(phaseDates);
    if (validationErrors.length > 0) {
      errors.push(
        ...validationErrors.map((message) => ({
          row: rowNum,
          field: 'dates',
          message,
        })),
      );
      continue;
    }

    items.push({
      mappingKey: normalizeProjectName(name),
      name,
      ...phaseDates,
    });
  }

  return { items, errors, valid: errors.length === 0 };
}

export function generateProjectImportPreview(
  items: ImportedProject[],
  existingProjects: Project[],
): ProjectImportPreview {
  const existingByKey = new Map(
    existingProjects.map((project) => [normalizeProjectName(project.name), project]),
  );

  const keyCounts = new Map<string, number>();
  for (const item of items) {
    keyCounts.set(item.mappingKey, (keyCounts.get(item.mappingKey) ?? 0) + 1);
  }

  const duplicateKeys = Array.from(keyCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const previewItems = items.map((item) => {
    const existing = existingByKey.get(item.mappingKey);
    return {
      action: existing ? 'update' : 'create',
      item,
      existingId: existing?.id ?? null,
    } satisfies ProjectImportPreviewItem;
  });

  return {
    items: previewItems,
    summary: {
      create: previewItems.filter((item) => item.action === 'create').length,
      update: previewItems.filter((item) => item.action === 'update').length,
    },
    duplicateKeys,
  };
}

export async function applyProjectImport(
  items: ImportedProject[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const existing = findProjectByName(item.name);
    if (existing) {
      await updateProjectPhaseDates(existing.id, item);
      updated += 1;
      continue;
    }

    await createProject(item.name, { phaseDates: item });
    created += 1;
  }

  return { created, updated };
}
