/**
 * Import contract — parses CSV work package data into task/template
 * creation inputs with validation.
 *
 * Expected CSV columns:
 *   title, workTypeTitle, workUnit, buildPhase, workQuantity,
 *   estimatedMinutes, defaultWorkers, targetProductivity
 *
 * Stable mapping key for round-trip: title + workTypeTitle + workUnit + buildPhase
 */

import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LABELS,
  type WorkCategory,
  type WorkUnit,
  type BuildPhase,
} from '../types';
import { findWorkTypeByKey } from '../stores/work-type-store';

const VALID_WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];
const VALID_BUILD_PHASES: BuildPhase[] = ['build-up', 'tear-down'];

export interface ImportedWorkPackage {
  /** Stable mapping key for round-trip reliability. */
  mappingKey: string;
  title: string;
  workTypeTitle: string;
  legacyWorkCategory: WorkCategory | null;
  workUnit: WorkUnit;
  buildPhase: BuildPhase;
  /** Resolved workTypeId from (title, workUnit, buildPhase). null if no match found. */
  workTypeId: string | null;
  workQuantity: number | null;
  estimatedMinutes: number | null;
  defaultWorkers: number | null;
  targetProductivity: number | null;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportParseResult {
  items: ImportedWorkPackage[];
  errors: ImportValidationError[];
  /** True if all rows parsed without errors. */
  valid: boolean;
}

/** Generate a stable mapping key from work package fields. */
export function workPackageMappingKey(
  title: string,
  workTypeTitle: string,
  workUnit: string,
  buildPhase: string,
): string {
  return `${title}::${workTypeTitle}:${workUnit}:${buildPhase}`;
}

/**
 * Parse CSV text into validated work packages.
 * First row must be headers. Subsequent rows are data.
 */
export function parseWorkPackageCsv(csvText: string): ImportParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { items: [], errors: [{ row: 0, field: 'csv', message: 'CSV must have a header row and at least one data row' }], valid: false };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const requiredHeaders = ['title', 'workunit', 'buildphase'];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  const hasWorkTypeTitle = headers.includes('worktypetitle');
  const hasLegacyCategory = headers.includes('workcategory');
  if (!hasWorkTypeTitle && !hasLegacyCategory) {
    missingHeaders.push('workTypeTitle');
  }
  if (missingHeaders.length > 0) {
    return {
      items: [],
      errors: [{ row: 0, field: 'headers', message: `Missing required headers: ${missingHeaders.join(', ')}` }],
      valid: false,
    };
  }

  const items: ImportedWorkPackage[] = [];
  const errors: ImportValidationError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    const fields = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] ?? '').trim();
    });

    const rowNum = i + 1; // 1-indexed, accounting for header
    const rowErrors: ImportValidationError[] = [];

    // Validate required fields
    const title = row['title'];
    if (!title) {
      rowErrors.push({ row: rowNum, field: 'title', message: 'Title is required' });
    }

    const legacyCategoryRaw = row['workcategory'];
    let legacyWorkCategory: WorkCategory | null = null;
    if (legacyCategoryRaw) {
      if (!WORK_CATEGORIES.includes(legacyCategoryRaw as WorkCategory)) {
        rowErrors.push({ row: rowNum, field: 'workCategory', message: `Invalid work category: "${legacyCategoryRaw}". Valid: ${WORK_CATEGORIES.join(', ')}` });
      } else {
        legacyWorkCategory = legacyCategoryRaw as WorkCategory;
      }
    }

    const workTypeTitleRaw = row['worktypetitle'];
    const workTypeTitle = workTypeTitleRaw
      ? workTypeTitleRaw
      : (legacyWorkCategory ? (WORK_CATEGORY_LABELS[legacyWorkCategory] ?? '') : '');
    if (!workTypeTitle) {
      rowErrors.push({ row: rowNum, field: 'workTypeTitle', message: 'Work type title is required' });
    }

    const workUnit = row['workunit'];
    if (!workUnit) {
      rowErrors.push({ row: rowNum, field: 'workUnit', message: 'Work unit is required' });
    } else if (!VALID_WORK_UNITS.includes(workUnit as WorkUnit)) {
      rowErrors.push({ row: rowNum, field: 'workUnit', message: `Invalid work unit: "${workUnit}". Valid: ${VALID_WORK_UNITS.join(', ')}` });
    }

    const buildPhase = row['buildphase'];
    if (!buildPhase) {
      rowErrors.push({ row: rowNum, field: 'buildPhase', message: 'Build phase is required' });
    } else if (!VALID_BUILD_PHASES.includes(buildPhase as BuildPhase)) {
      rowErrors.push({ row: rowNum, field: 'buildPhase', message: `Invalid build phase: "${buildPhase}". Valid: ${VALID_BUILD_PHASES.join(', ')}` });
    }

    // Validate optional numeric fields
    const workQuantity = parseOptionalNumber(row['workquantity'], rowNum, 'workQuantity', rowErrors);
    const estimatedMinutes = parseOptionalNumber(row['estimatedminutes'], rowNum, 'estimatedMinutes', rowErrors);
    const defaultWorkers = parseOptionalNumber(row['defaultworkers'], rowNum, 'defaultWorkers', rowErrors);
    const targetProductivity = parseOptionalNumber(row['targetproductivity'], rowNum, 'targetProductivity', rowErrors);

    if (workQuantity != null && workQuantity <= 0) {
      rowErrors.push({ row: rowNum, field: 'workQuantity', message: 'Work quantity must be positive' });
    }
    if (defaultWorkers != null && (defaultWorkers < 1 || defaultWorkers > 20)) {
      rowErrors.push({ row: rowNum, field: 'defaultWorkers', message: 'Default workers must be between 1 and 20' });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    // Resolve WorkType by key (title + unit + phase)
    const resolvedWorkType = findWorkTypeByKey(
      workTypeTitle,
      workUnit as WorkUnit,
      buildPhase as BuildPhase,
    );

    items.push({
      mappingKey: workPackageMappingKey(title, workTypeTitle, workUnit, buildPhase),
      title,
      workTypeTitle,
      legacyWorkCategory,
      workUnit: workUnit as WorkUnit,
      buildPhase: buildPhase as BuildPhase,
      workTypeId: resolvedWorkType?.id ?? null,
      workQuantity,
      estimatedMinutes,
      defaultWorkers,
      targetProductivity,
    });
  }

  return { items, errors, valid: errors.length === 0 };
}

function parseOptionalNumber(
  value: string | undefined,
  row: number,
  field: string,
  errors: ImportValidationError[],
): number | null {
  if (!value || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) {
    errors.push({ row, field, message: `"${value}" is not a valid number` });
    return null;
  }
  return num;
}

/** Parse a single CSV line, handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}
