import { createWorkType, findWorkTypeByKey } from '../../stores/work-type-store';
import type { WorkType } from '../../types';

export async function resolveImportedWorkTypeIds(
  _planId: string,
  workTypes: WorkType[],
  tagIdRemap?: Map<string, string>,
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  for (const imported of workTypes) {
    const existing = findWorkTypeByKey(imported.title, imported.workUnit);
    if (existing) {
      mapping.set(imported.id, existing.id);
      continue;
    }

    const remappedTagIds = imported.tagIds?.length
      ? imported.tagIds.map((id) => tagIdRemap?.get(id) ?? id)
      : undefined;
    const created = await createWorkType({
      title: imported.title,
      workUnit: imported.workUnit,
      assemblyRate: imported.assemblyRate ?? 0,
      dismantleRate: imported.dismantleRate ?? 0,
      tagIds: remappedTagIds,
    });
    mapping.set(imported.id, created.id);
  }
  return mapping;
}
