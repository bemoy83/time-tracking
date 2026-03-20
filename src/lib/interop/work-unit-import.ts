import {
  isValidWorkUnitId,
  normalizeWorkUnitId,
  type WorkUnit,
} from '../types';
import { ensureImportedWorkUnits } from '../stores/work-unit-store';
import type { EnsureImportedWorkUnitInput, EnsureImportedWorkUnitsOptions } from '../work-unit-domain';

interface ImportValidationLike {
  row: number;
  field: string;
  message: string;
}

export interface ParsedWorkUnitReference {
  workUnit: WorkUnit;
  workUnitLabel: string | null;
}

export function parseWorkUnitReference(
  rawId: string | undefined,
  rawLabel: string | undefined | null,
  row: number,
  errors: ImportValidationLike[],
  field: string = 'workUnit',
): ParsedWorkUnitReference | null {
  const value = rawId?.trim() ?? '';
  if (!value) {
    errors.push({ row, field, message: 'Work unit is required' });
    return null;
  }

  const normalized = normalizeWorkUnitId(value);
  if (!isValidWorkUnitId(normalized)) {
    errors.push({
      row,
      field,
      message: `Invalid work unit: "${value}". Use lowercase slug ids like "m2" or "pallets".`,
    });
    return null;
  }

  return {
    workUnit: normalized as WorkUnit,
    workUnitLabel: rawLabel?.trim() || null,
  };
}

export function collectWorkUnitRefsFromItems<T>(
  items: T[],
  pick: (item: T) => ParsedWorkUnitReference,
): EnsureImportedWorkUnitInput[] {
  return items.map((item) => {
    const reference = pick(item);
    return {
      id: reference.workUnit,
      label: reference.workUnitLabel ?? reference.workUnit,
    };
  });
}

export async function provisionWorkUnitsForImport<T>(
  items: T[],
  pick: (item: T) => ParsedWorkUnitReference,
  options: EnsureImportedWorkUnitsOptions = {},
  ensureImportedWorkUnitsFn: typeof ensureImportedWorkUnits = ensureImportedWorkUnits,
) {
  return ensureImportedWorkUnitsFn(collectWorkUnitRefsFromItems(items, pick), options);
}
