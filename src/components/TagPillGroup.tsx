import { TagPill } from './TagPill';
import { useTagStore } from '../lib/stores/tag-store';

interface TagPillGroupProps {
  /** Tag IDs to display */
  tagIds: string[];
  /** If provided, shows remove button on each pill */
  onRemoveTag?: (tagId: string) => void;
  /** If provided, shows an add button at the end */
  onAddTag?: () => void;
  /** Compact spacing variant */
  compact?: boolean;
  className?: string;
}

/**
 * Renders a group of tag pills from an array of tag IDs.
 * Reads tag definitions from the global tag store.
 */
export function TagPillGroup({
  tagIds,
  onRemoveTag,
  onAddTag,
  compact,
  className,
}: TagPillGroupProps) {
  const { tags } = useTagStore();
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  const resolvedTags = tagIds
    .map((id) => tagsById.get(id))
    .filter((t): t is NonNullable<typeof t> => t != null);

  if (resolvedTags.length === 0 && !onAddTag) return null;

  return (
    <div className={`tag-pill-group${compact ? ' tag-pill-group--compact' : ''}${className ? ` ${className}` : ''}`}>
      {resolvedTags.map((tag) => (
        <TagPill
          key={tag.id}
          tag={tag}
          onRemove={onRemoveTag ? () => onRemoveTag(tag.id) : undefined}
        />
      ))}
      {onAddTag && (
        <button
          type="button"
          className="tag-pill-group__add-btn"
          onClick={onAddTag}
          aria-label="Add tag"
        >
          + Tag
        </button>
      )}
    </div>
  );
}
