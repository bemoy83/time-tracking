import { ActionSheet } from './ActionSheet';
import { useTagStore, getCategoriesWithTags } from '../lib/stores/tag-store';

interface TagPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Currently selected additional tag IDs (task-level extras, not inherited) */
  selectedTagIds: string[];
  /** Tag IDs already inherited from WorkType — shown as locked/greyed, not pickable */
  inheritedTagIds?: string[];
  onChange: (tagIds: string[]) => void;
  title?: string;
}

/**
 * Bottom sheet for selecting additional tags on a task or line item.
 * Tags are grouped by category. Inherited WorkType tags are shown as
 * disabled — already present and cannot be re-added or removed here.
 * No freeform tag creation — only existing global tags can be picked.
 */
export function TagPickerSheet({
  isOpen,
  onClose,
  selectedTagIds,
  inheritedTagIds = [],
  onChange,
  title = 'Add Tags',
}: TagPickerSheetProps) {
  const storeState = useTagStore();
  const categoriesWithTags = getCategoriesWithTags();
  const selectedSet = new Set(selectedTagIds);
  const inheritedSet = new Set(inheritedTagIds);

  const hasAnyTags = storeState.tags.length > 0;

  function toggleTag(tagId: string) {
    if (inheritedSet.has(tagId)) return; // inherited — not toggleable here
    const next = new Set(selectedSet);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    onChange(Array.from(next));
  }

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="tag-picker__categories">
        {!hasAnyTags && (
          <p className="tag-picker__empty">
            No tags configured. Create tags in Settings → Tags.
          </p>
        )}
        {categoriesWithTags.map(({ category, tags }) => {
          if (tags.length === 0) return null;
          return (
            <div key={category.id} className="tag-picker__category">
              <div className="tag-picker__category-label">{category.name}</div>
              <div className="tag-picker__options">
                {tags.map((tag) => {
                  const isInherited = inheritedSet.has(tag.id);
                  const isSelected = selectedSet.has(tag.id);

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={[
                        'tag-picker__option',
                        isSelected || isInherited ? 'tag-picker__option--selected' : '',
                        isInherited ? 'tag-picker__option--disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ '--tag-option-color': tag.color } as React.CSSProperties}
                      onClick={() => toggleTag(tag.id)}
                      disabled={isInherited}
                      aria-pressed={isSelected || isInherited}
                    >
                      <span className="tag-picker__option-dot" />
                      <span className="tag-picker__option-name">{tag.name}</span>
                      {isInherited && (
                        <span className="tag-picker__inherited-note">from work type</span>
                      )}
                      {(isSelected || isInherited) && (
                        <span className="tag-picker__option-check">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ActionSheet>
  );
}
