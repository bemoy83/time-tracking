export type WorkUnit = string;

export interface WorkUnitDefinition {
  id: WorkUnit;
  label: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  builtIn: boolean;
}

export const BUILT_IN_WORK_UNIT_DEFINITIONS = [
  { id: 'm2', label: 'm\u00B2' },
  { id: 'm', label: 'm' },
  { id: 'pcs', label: 'pcs' },
  { id: 'orders', label: 'orders' },
] as const;

export const BUILT_IN_WORK_UNIT_IDS: WorkUnit[] = BUILT_IN_WORK_UNIT_DEFINITIONS.map((unit) => unit.id);

export const WORK_UNIT_ID_MAX_LENGTH = 64;
export const WORK_UNIT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BUILT_IN_WORK_UNIT_LABELS = Object.freeze(
  Object.fromEntries(BUILT_IN_WORK_UNIT_DEFINITIONS.map((unit) => [unit.id, unit.label])) as Record<string, string>,
);

export const WORK_UNIT_LABELS: Record<string, string> = { ...BUILT_IN_WORK_UNIT_LABELS };

export function getBuiltInWorkUnitLabel(id: string): string | undefined {
  return BUILT_IN_WORK_UNIT_LABELS[id];
}

export function isBuiltInWorkUnit(id: string): boolean {
  return BUILT_IN_WORK_UNIT_IDS.includes(id);
}

export function resolveWorkUnitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return WORK_UNIT_LABELS[unit] ?? BUILT_IN_WORK_UNIT_LABELS[unit] ?? unit;
}

export function syncWorkUnitLabelRegistry(definitions: WorkUnitDefinition[]): void {
  for (const key of Object.keys(WORK_UNIT_LABELS)) {
    delete WORK_UNIT_LABELS[key];
  }

  for (const [id, label] of Object.entries(BUILT_IN_WORK_UNIT_LABELS)) {
    WORK_UNIT_LABELS[id] = label;
  }

  for (const definition of definitions) {
    WORK_UNIT_LABELS[definition.id] = definition.label;
  }
}

export function normalizeWorkUnitId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidWorkUnitId(id: string): boolean {
  return id.length > 0
    && id.length <= WORK_UNIT_ID_MAX_LENGTH
    && WORK_UNIT_ID_PATTERN.test(id);
}

export function sanitizeWorkUnitIdCandidate(label: string): string {
  return normalizeWorkUnitId(label)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function generateWorkUnitIdFromLabel(
  label: string,
  existingIds: Iterable<string>,
): string {
  const ids = new Set(Array.from(existingIds, normalizeWorkUnitId));
  const rawBase = sanitizeWorkUnitIdCandidate(label) || 'unit';
  const base = rawBase.slice(0, WORK_UNIT_ID_MAX_LENGTH).replace(/-+$/g, '') || 'unit';

  if (!ids.has(base)) {
    return base;
  }

  let suffix = 2;
  while (suffix < 10_000) {
    const suffixText = `-${suffix}`;
    const maxBaseLength = WORK_UNIT_ID_MAX_LENGTH - suffixText.length;
    const prefix = base.slice(0, Math.max(1, maxBaseLength)).replace(/-+$/g, '') || 'unit';
    const candidate = `${prefix}${suffixText}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }

  throw new Error('Could not generate a unique work unit id.');
}

export function buildSeededWorkUnitDefinitions(now: string): WorkUnitDefinition[] {
  return BUILT_IN_WORK_UNIT_DEFINITIONS.map((unit, index) => ({
    id: unit.id,
    label: unit.label,
    sortIndex: index,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    builtIn: true,
  }));
}
