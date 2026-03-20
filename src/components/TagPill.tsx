import type { Tag } from '../lib/tags';

interface TagPillProps {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
}

/**
 * A single colored tag pill.
 * Shows a remove button when onRemove is provided.
 */
export function TagPill({ tag, onRemove, className }: TagPillProps) {
  return (
    <span
      className={`tag-pill${onRemove ? ' tag-pill--removable' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--tag-color': tag.color } as React.CSSProperties}
      title={tag.name}
    >
      {tag.name}
      {onRemove && (
        <button
          className="tag-pill__remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove tag ${tag.name}`}
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}
