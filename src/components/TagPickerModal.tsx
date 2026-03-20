/**
 * TagPickerModal — centered modal variant of the tag picker.
 *
 * Renders via React Portal directly into document.body so it is never
 * clipped or re-contained by ancestor `transform` / `overflow: clip`
 * rules (the root cause of the ActionSheet not appearing inside the
 * planning workspace, which has an entrance animation that keeps
 * `transform: translateY(0)` in effect via fill-mode: both).
 *
 * Visual: centered dialog, matching the new-plan-modal pattern.
 * Use in contexts where the tag picker would otherwise be clipped
 * (WorkPackageTable inside planning workspace).
 *
 * For task-detail / settings use cases, TagPickerSheet (ActionSheet)
 * is still appropriate and works correctly there.
 */

import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { useModalFocusTrap } from '../lib/hooks/useModalFocusTrap';
import { useTagStore, getCategoriesWithTags } from '../lib/stores/tag-store';
import { XIcon } from './icons';

interface TagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Currently selected tag IDs on the line item */
  selectedTagIds: string[];
  /** Tag IDs locked from WorkType — shown disabled */
  inheritedTagIds?: string[];
  onChange: (tagIds: string[]) => void;
  title?: string;
}

export function TagPickerModal({
  isOpen,
  onClose,
  selectedTagIds,
  inheritedTagIds = [],
  onChange,
  title = 'Assign Tags',
}: TagPickerModalProps) {
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocusTrap(isOpen, onClose, firstFocusRef);

  const storeState = useTagStore();
  const categoriesWithTags = getCategoriesWithTags();
  const selectedSet = new Set(selectedTagIds);
  const inheritedSet = new Set(inheritedTagIds);
  const hasAnyTags = storeState.tags.length > 0;

  function toggleTag(tagId: string) {
    if (inheritedSet.has(tagId)) return;
    const next = new Set(selectedSet);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    onChange(Array.from(next));
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className="new-plan-modal-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className="new-plan-modal tag-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="new-plan-modal__header">
          <h2 className="new-plan-modal__title">{title}</h2>
          <button
            ref={firstFocusRef}
            type="button"
            className="new-plan-modal__close"
            onClick={onClose}
            aria-label="Close tag picker"
          >
            <XIcon className="new-plan-modal__close-icon" />
          </button>
        </div>

        {/* Body */}
        <div className="tag-picker-modal__body">
          {!hasAnyTags && (
            <p className="tag-picker__empty">
              No tags configured. Create tags in Settings → Tags.
            </p>
          )}

          <div className="tag-picker__categories">
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
        </div>

        {/* Footer */}
        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
