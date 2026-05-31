import { useMemo } from 'react';
import type { WorkType, Task } from '../../../lib/types';
import { resolveWorkUnitLabel } from '../../../lib/types';
import type { Tag } from '../../../lib/tags';
import type { WorkTypeFilters, WorkUnitOption, TagOption } from '../WorkTypeFilterBar';

interface WorkTypeListData {
  editableWorkTypes: WorkType[];
  unitOptions: WorkUnitOption[];
  tagOptions: TagOption[];
  displayedWorkTypes: WorkType[];
  usageByWorkTypeId: Map<string, number>;
}

export function useWorkTypeListData(
  workTypes: WorkType[],
  tagById: Map<string, Tag>,
  tasks: Task[],
  filters: WorkTypeFilters,
): WorkTypeListData {
  const editableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );

  const usageByWorkTypeId = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.archivedAt !== null || !task.workTypeId) continue;
      map.set(task.workTypeId, (map.get(task.workTypeId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const unitOptions = useMemo<WorkUnitOption[]>(() => {
    const counts = new Map<string, number>();
    for (const wt of editableWorkTypes) {
      counts.set(wt.workUnit, (counts.get(wt.workUnit) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, label: resolveWorkUnitLabel(id), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [editableWorkTypes]);

  const tagOptions = useMemo<TagOption[]>(() => {
    const counts = new Map<string, number>();
    for (const wt of editableWorkTypes) {
      const seen = new Set([...(wt.tagIds ?? []), ...(wt.skillTagId ? [wt.skillTagId] : [])]);
      for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .flatMap(([id, count]) => {
        const tag = tagById.get(id);
        if (!tag) return [];
        return [{ id, name: tag.name, color: tag.color, count, isSkill: tag.skillTag }];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [editableWorkTypes, tagById]);

  const displayedWorkTypes = useMemo(() => {
    let result = editableWorkTypes;

    const q = filters.search.trim().toLowerCase();
    if (q) result = result.filter((wt) => wt.title.toLowerCase().includes(q));

    if (filters.unitFilter.length > 0) {
      const unitSet = new Set(filters.unitFilter);
      result = result.filter((wt) => unitSet.has(wt.workUnit));
    }

    if (filters.tagFilter.length > 0) {
      const tagSet = new Set(filters.tagFilter);
      result = result.filter(
        (wt) =>
          wt.tagIds?.some((id) => tagSet.has(id)) ||
          (wt.skillTagId != null && tagSet.has(wt.skillTagId)),
      );
    }

    const sorted = [...result];
    if (filters.sortOrder === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (filters.sortOrder === 'za') sorted.sort((a, b) => b.title.localeCompare(a.title));
    else sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return sorted;
  }, [editableWorkTypes, filters]);

  return { editableWorkTypes, unitOptions, tagOptions, displayedWorkTypes, usageByWorkTypeId };
}
