import {
  type BuildPhase,
  BUILD_PHASES,
  type WorkType,
  type WorkUnit,
  WORK_UNITS,
  workTypeKeyString,
} from '../types';
import {
  createWorkType,
  findWorkTypeByKey,
  updateWorkTypeFields,
} from '../stores/work-type-store';
import { detectCsvDelimiter, parseCsvLine } from './csv-utils';

export interface ImportedWorkType {
  mappingKey: string;
  title: string;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  expectedProductivity: number;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface WorkTypeImportParseResult {
  items: ImportedWorkType[];
  errors: ImportValidationError[];
  valid: boolean;
}

export type WorkTypeImportAction = 'create' | 'update';

export interface WorkTypeImportPreviewItem {
  action: WorkTypeImportAction;
  item: ImportedWorkType;
  existingId: string | null;
}

export interface WorkTypeImportPreview {
  items: WorkTypeImportPreviewItem[];
  summary: {
    create: number;
    update: number;
  };
  /** Duplicate mapping keys within the import set. Resolve before apply. */
  duplicateKeys: string[];
}

/**
 * Parse CSV text into validated WorkType definitions.
 * Required columns: title, workUnit, buildPhase, expectedProductivity
 */
export function parseWorkTypeCsv(csvText: string): WorkTypeImportParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      items: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV must have a header row and at least one data row' }],
      valid: false,
    };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.trim().toLowerCase());
  const requiredHeaders = ['title', 'workunit', 'buildphase', 'expectedproductivity'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return {
      items: [],
      errors: [{ row: 0, field: 'headers', message: `Missing required headers: ${missingHeaders.join(', ')}` }],
      valid: false,
    };
  }

  const items: ImportedWorkType[] = [];
  const errors: ImportValidationError[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '') continue;

    const fields = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = (fields[headerIndex] ?? '').trim();
    });

    const rowNum = index + 1;
    const rowErrors: ImportValidationError[] = [];

    const title = row.title;
    if (!title) {
      rowErrors.push({ row: rowNum, field: 'title', message: 'Title is required' });
    }

    const workUnitRaw = row.workunit;
    if (!workUnitRaw) {
      rowErrors.push({ row: rowNum, field: 'workUnit', message: 'Work unit is required' });
    } else if (!WORK_UNITS.includes(workUnitRaw as WorkUnit)) {
      rowErrors.push({
        row: rowNum,
        field: 'workUnit',
        message: `Invalid work unit: "${workUnitRaw}". Valid: ${WORK_UNITS.join(', ')}`,
      });
    }

    const buildPhaseRaw = row.buildphase;
    if (!buildPhaseRaw) {
      rowErrors.push({ row: rowNum, field: 'buildPhase', message: 'Build phase is required' });
    } else if (!BUILD_PHASES.includes(buildPhaseRaw as BuildPhase)) {
      rowErrors.push({
        row: rowNum,
        field: 'buildPhase',
        message: `Invalid build phase: "${buildPhaseRaw}". Valid: ${BUILD_PHASES.join(', ')}`,
      });
    }

    const expectedProductivity = parseRequiredNumber(
      row.expectedproductivity,
      rowNum,
      'expectedProductivity',
      rowErrors,
    );

    if (expectedProductivity != null && expectedProductivity <= 0) {
      rowErrors.push({
        row: rowNum,
        field: 'expectedProductivity',
        message: 'Expected productivity must be a positive number',
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    items.push({
      mappingKey: workTypeKeyString(title, workUnitRaw as WorkUnit, buildPhaseRaw as BuildPhase),
      title,
      workUnit: workUnitRaw as WorkUnit,
      buildPhase: buildPhaseRaw as BuildPhase,
      expectedProductivity: expectedProductivity as number,
    });
  }

  return { items, errors, valid: errors.length === 0 };
}

export function generateWorkTypeImportPreview(
  items: ImportedWorkType[],
  existingWorkTypes: WorkType[],
): WorkTypeImportPreview {
  const existingByKey = new Map(
    existingWorkTypes.map((workType) => [workTypeKeyString(workType.title, workType.workUnit, workType.buildPhase), workType]),
  );

  const keyCounts = new Map<string, number>();
  for (const item of items) {
    keyCounts.set(item.mappingKey, (keyCounts.get(item.mappingKey) ?? 0) + 1);
  }
  const duplicateKeys = Array.from(keyCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const previewItems: WorkTypeImportPreviewItem[] = items.map((item) => {
    const existing = existingByKey.get(item.mappingKey);
    if (!existing) {
      return {
        action: 'create',
        item,
        existingId: null,
      };
    }

    return {
      action: 'update',
      item,
      existingId: existing.id,
    };
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

export async function applyWorkTypeImport(
  items: ImportedWorkType[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const existing = findWorkTypeByKey(item.title, item.workUnit, item.buildPhase);

    if (existing) {
      await updateWorkTypeFields(existing.id, {
        title: item.title,
        workUnit: item.workUnit,
        buildPhase: item.buildPhase,
        expectedProductivity: item.expectedProductivity,
      });
      updated += 1;
      continue;
    }

    await createWorkType({
      title: item.title,
      workUnit: item.workUnit,
      buildPhase: item.buildPhase,
      expectedProductivity: item.expectedProductivity,
    });
    created += 1;
  }

  return { created, updated };
}

function parseRequiredNumber(
  value: string | undefined,
  row: number,
  field: string,
  errors: ImportValidationError[],
): number | null {
  if (!value || value === '') {
    errors.push({ row, field, message: `${field} is required` });
    return null;
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    errors.push({ row, field, message: `"${value}" is not a valid number` });
    return null;
  }

  return num;
}
