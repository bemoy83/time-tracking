/**
 * Import contract — parses a dual-phase CSV into PlanLineItem inputs.
 *
 * One CSV row = one work package (both assembly and dismantle columns).
 * Follows the same pattern as work-type-import.ts.
 *
 * Required CSV columns: title, workTypeTitle, workUnit
 * Optional CSV columns: workQuantity, assemblyRate, assemblyCrew,
 *   assemblyEstimatedMinutes, dismantleRate, dismantleCrew,
 *   dismantleEstimatedMinutes
 */

import { type WorkUnit, WORK_UNITS, workTypeKeyString } from '../types';
import { findWorkTypeByKey } from '../stores/work-type-store';
import { detectCsvDelimiter, parseCsvLine, csvRow } from './csv-utils';
import { normalizeNumberString } from './number-parse';
import { type PlanLineItem } from '../planning/plan-model';
import { createLineItem } from '../planning/plan-model';

const PLAN_LINE_ITEM_CSV_HEADERS = [
  'title',
  'workTypeTitle',
  'workUnit',
  'workQuantity',
  'assemblyRate',
  'assemblyCrew',
  'assemblyEstimatedMinutes',
  'dismantleRate',
  'dismantleCrew',
  'dismantleEstimatedMinutes',
];

/** Generate a sample CSV with one example row showing all supported fields. */
export function exportPlanLineItemCsvSample(): string {
  return [
    csvRow(PLAN_LINE_ITEM_CSV_HEADERS),
    csvRow([
      'Carpet Tiles Hall A',
      'Carpet Tiles',
      'm2',
      500,
      12,
      2,
      '',
      6,
      1,
      '',
    ]),
    csvRow([
      'Staging Risers',
      'Staging',
      'pcs',
      80,
      8,
      3,
      '',
      4,
      2,
      '',
    ]),
  ].join('\n');
}

export interface ImportedPlanLineItem {
  /** Stable mapping key: title::workTypeTitle:workUnit (no phase). */
  mappingKey: string;
  title: string;
  workTypeTitle: string;
  workUnit: WorkUnit;
  /** Resolved from findWorkTypeByKey; null if no match. */
  workTypeId: string | null;
  workQuantity: number;
  assemblyRate: number;
  /** null means not provided — will be auto-set from rate. */
  assemblyCrew: number | null;
  /** null means not provided — time will be computed from rate. */
  assemblyEstimatedMinutes: number | null;
  dismantleRate: number;
  dismantleCrew: number | null;
  dismantleEstimatedMinutes: number | null;
}

export interface PlanLineItemImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface PlanLineItemImportParseResult {
  items: ImportedPlanLineItem[];
  errors: PlanLineItemImportValidationError[];
  valid: boolean;
}

/** Generate a stable mapping key for a plan line item (no phase). */
export function planLineItemMappingKey(
  title: string,
  workTypeTitle: string,
  workUnit: WorkUnit,
): string {
  return workTypeKeyString(`${title}::${workTypeTitle}`, workUnit);
}

/**
 * Parse CSV text into validated dual-phase plan line item inputs.
 * Required columns: title, worktypetitle, workunit
 */
export function parsePlanLineItemCsv(csvText: string): PlanLineItemImportParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      items: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV must have a header row and at least one data row' }],
      valid: false,
    };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

  const requiredHeaders = ['title', 'worktypetitle', 'workunit'];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      items: [],
      errors: [{ row: 0, field: 'headers', message: `Missing required headers: ${missingHeaders.join(', ')}` }],
      valid: false,
    };
  }

  const items: ImportedPlanLineItem[] = [];
  const errors: PlanLineItemImportValidationError[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '') continue;

    const fields = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (fields[i] ?? '').trim();
    });

    const rowNum = index + 1;
    const rowErrors: PlanLineItemImportValidationError[] = [];

    const title = row['title'] ?? '';
    if (!title) {
      rowErrors.push({ row: rowNum, field: 'title', message: 'Title is required' });
    }

    const workTypeTitle = row['worktypetitle'] ?? '';
    if (!workTypeTitle) {
      rowErrors.push({ row: rowNum, field: 'workTypeTitle', message: 'Work type title is required' });
    }

    const workUnitRaw = row['workunit'] ?? '';
    if (!workUnitRaw) {
      rowErrors.push({ row: rowNum, field: 'workUnit', message: 'Work unit is required' });
    } else if (!WORK_UNITS.includes(workUnitRaw as WorkUnit)) {
      rowErrors.push({
        row: rowNum,
        field: 'workUnit',
        message: `Invalid work unit: "${workUnitRaw}". Valid: ${WORK_UNITS.join(', ')}`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const workUnit = workUnitRaw as WorkUnit;
    const workQuantity = parseOptionalNumber(row['workquantity'], rowNum, 'workQuantity', errors) ?? 0;
    if (workQuantity === 0) continue; // skip zero-quantity rows (not applicable to this event)

    const assemblyRate = parseOptionalNumber(row['assemblyrate'], rowNum, 'assemblyRate', errors) ?? 0;
    const assemblyCrew = parseOptionalNumberOrNull(row['assemblycrew'], rowNum, 'assemblyCrew', errors);
    const assemblyEstimatedMinutes = parseOptionalNumberOrNull(row['assemblyestimatedminutes'], rowNum, 'assemblyEstimatedMinutes', errors);
    const dismantleRate = parseOptionalNumber(row['dismantlerate'], rowNum, 'dismantleRate', errors) ?? 0;
    const dismantleCrew = parseOptionalNumberOrNull(row['dismantlecrew'], rowNum, 'dismantleCrew', errors);
    const dismantleEstimatedMinutes = parseOptionalNumberOrNull(row['dismantleestimatedminutes'], rowNum, 'dismantleEstimatedMinutes', errors);

    const workTypeId = findWorkTypeByKey(workTypeTitle, workUnit)?.id ?? null;

    items.push({
      mappingKey: planLineItemMappingKey(title, workTypeTitle, workUnit),
      title,
      workTypeTitle,
      workUnit,
      workTypeId,
      workQuantity,
      assemblyRate,
      assemblyCrew,
      assemblyEstimatedMinutes,
      dismantleRate,
      dismantleCrew,
      dismantleEstimatedMinutes,
    });
  }

  return { items, errors, valid: errors.length === 0 };
}

/**
 * Convert parsed ImportedPlanLineItem[] to PlanLineItem[] ready to be added to a plan.
 * Caller must ensure workTypeId is resolved (via ensureWorkTypeExistsOrCreate) before calling.
 */
export function importedPlanLineItemsToLineItems(
  imported: ImportedPlanLineItem[],
): PlanLineItem[] {
  return imported.map((item) => {
    // Fall back to stored work type rates when CSV didn't provide them.
    const storedWorkType = findWorkTypeByKey(item.workTypeTitle, item.workUnit);
    const assemblyRate = item.assemblyRate || storedWorkType?.assemblyRate || 0;
    const dismantleRate = item.dismantleRate || storedWorkType?.dismantleRate || 0;

    const base = createLineItem(
      item.title,
      item.workTypeTitle,
      item.workUnit,
      item.workQuantity,
      assemblyRate,
      dismantleRate,
      'manual',
      item.workTypeId,
    );

    // Patch with explicit CSV values where provided, overriding auto-computed defaults.
    const assemblyTimeHours =
      item.assemblyEstimatedMinutes !== null
        ? item.assemblyEstimatedMinutes / 60
        : base.assemblyTimeHours;

    const assemblyCrew =
      item.assemblyCrew !== null ? item.assemblyCrew : base.assemblyCrew;

    const dismantleTimeHours =
      item.dismantleEstimatedMinutes !== null
        ? item.dismantleEstimatedMinutes / 60
        : base.dismantleTimeHours;

    const dismantleCrew =
      item.dismantleCrew !== null ? item.dismantleCrew : base.dismantleCrew;

    return {
      ...base,
      assemblyTimeHours,
      assemblyCrew,
      dismantleTimeHours,
      dismantleCrew,
    };
  });
}

/** Parse an optional number field; returns 0 if empty, null on parse error. */
function parseOptionalNumber(
  value: string | undefined,
  row: number,
  field: string,
  errors: PlanLineItemImportValidationError[],
): number | null {
  if (!value || value === '') return 0;
  const normalized = normalizeNumberString(value);
  const num = Number(normalized);
  if (Number.isNaN(num)) {
    errors.push({ row, field, message: `"${value}" is not a valid number` });
    return null;
  }
  return num;
}

/**
 * Parse an optional number field that distinguishes "not provided" (null)
 * from "provided as 0". Returns null if empty, the number if present.
 */
function parseOptionalNumberOrNull(
  value: string | undefined,
  row: number,
  field: string,
  errors: PlanLineItemImportValidationError[],
): number | null {
  if (!value || value === '') return null;
  const normalized = normalizeNumberString(value);
  const num = Number(normalized);
  if (Number.isNaN(num)) {
    errors.push({ row, field, message: `"${value}" is not a valid number` });
    return null;
  }
  return num;
}
