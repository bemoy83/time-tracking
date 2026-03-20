/**
 * TaskTagsSection — displays and manages tags on a task.
 *
 * Shows inherited WorkType tags (read-only) and additional task-specific tags
 * (editable). Uses ExpandableSection like other task detail blocks. WorkType
 * tags cannot be removed at the task level.
 */

import { useState } from 'react';
import { TagPill } from './TagPill';
import { TagPickerSheet } from './TagPickerSheet';
import { ExpandableSection } from './ExpandableSection';
import { TagIcon } from './icons';
import { pluralize } from '../lib/utils/pluralize';
import { useTagStore } from '../lib/stores/tag-store';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import { updateTaskFields } from '../lib/stores/task-store';
import type { Task } from '../lib/types';

interface TaskTagsSectionProps {
  task: Task;
}

export function TaskTagsSection({ task }: TaskTagsSectionProps) {
  const { tags } = useTagStore();
  const { workTypes } = useWorkTypeStore();
  const [showPicker, setShowPicker] = useState(false);

  const tagsById = new Map(tags.map((t) => [t.id, t]));

  // Tags inherited from WorkType (always shown, locked)
  const workType = task.workTypeId ? workTypes.find((wt) => wt.id === task.workTypeId) : undefined;
  const inheritedTagIds = workType?.tagIds ?? [];

  // Additional tags added specifically to this task
  const additionalTagIds = task.additionalTagIds ?? [];

  const hasAnyTags = inheritedTagIds.length > 0 || additionalTagIds.length > 0;
  const totalTagCount = inheritedTagIds.length + additionalTagIds.length;
  const sectionSummary =
    totalTagCount > 0
      ? pluralize(totalTagCount, 'tag')
      : task.workTypeId
        ? 'Add tags'
        : undefined;

  async function handleAdditionalTagsChange(newAdditionalTagIds: string[]) {
    await updateTaskFields(task.id, { additionalTagIds: newAdditionalTagIds });
  }

  async function handleRemoveAdditionalTag(tagId: string) {
    await updateTaskFields(task.id, {
      additionalTagIds: additionalTagIds.filter((id) => id !== tagId),
    });
  }

  // Only show section when there are tags or a work type is set
  if (!hasAnyTags && !task.workTypeId) return null;

  return (
    <>
      <ExpandableSection
        key={task.id}
        label="Tags"
        icon={<TagIcon className="task-tags__icon" />}
        defaultOpen={hasAnyTags}
        sectionSummary={sectionSummary}
      >
        <div className="task-tags__content">
          <div className="tag-pill-group">
            {/* Inherited WorkType tags — read-only */}
            {inheritedTagIds.map((tagId) => {
              const tag = tagsById.get(tagId);
              if (!tag) return null;
              return (
                <span key={tagId} title={`Inherited from work type: ${workType?.title}`}>
                  <TagPill tag={tag} />
                </span>
              );
            })}

            {/* Additional task-specific tags — removable */}
            {additionalTagIds.map((tagId) => {
              const tag = tagsById.get(tagId);
              if (!tag) return null;
              return (
                <TagPill
                  key={tagId}
                  tag={tag}
                  onRemove={() => handleRemoveAdditionalTag(tagId)}
                />
              );
            })}

            <button
              type="button"
              className="tag-pill-group__add-btn"
              onClick={() => setShowPicker(true)}
            >
              + Tag
            </button>
          </div>
        </div>
      </ExpandableSection>

      <TagPickerSheet
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        selectedTagIds={additionalTagIds}
        inheritedTagIds={inheritedTagIds}
        onChange={handleAdditionalTagsChange}
        title="Add Tags to Task"
      />
    </>
  );
}
