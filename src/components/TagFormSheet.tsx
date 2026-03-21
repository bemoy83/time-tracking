import { useState, useEffect } from 'react';
import { ActionSheet } from './ActionSheet';
import { useTagStore } from '../lib/stores/tag-store';
import type { Tag } from '../lib/tags';
import { TAG_COLORS, TAG_COLOR_DEFAULT } from '../lib/tags';

interface TagFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, form is in edit mode for this tag */
  editTag?: Tag;
  /** Pre-selected category for create mode */
  defaultCategoryId?: string;
  onSubmit: (values: { name: string; color: string; categoryId: string; sequencable: boolean; skillTag: boolean }) => Promise<void>;
}

/**
 * Bottom sheet for creating or editing a tag.
 * Includes name input, category selector, and color picker.
 */
export function TagFormSheet({
  isOpen,
  onClose,
  editTag,
  defaultCategoryId,
  onSubmit,
}: TagFormSheetProps) {
  const { categories, isLoading } = useTagStore();

  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLOR_DEFAULT);
  const [categoryId, setCategoryId] = useState('');
  const [sequencable, setSequencable] = useState(false);
  const [skillTag, setSkillTag] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = editTag != null;

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setName(editTag?.name ?? '');
      setColor(editTag?.color ?? TAG_COLOR_DEFAULT);
      setCategoryId(editTag?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '');
      setSequencable(editTag?.sequencable ?? false);
      setSkillTag(editTag?.skillTag ?? false);
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, editTag, defaultCategoryId, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tag name is required');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), color, categoryId, sequencable, skillTag });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ActionSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Tag' : 'New Tag'}
    >
      <form className="tag-form" onSubmit={handleSubmit}>
        {/* Category */}
        <div className="tag-form__field">
          <label className="tag-form__label" htmlFor="tag-category">
            Category
          </label>
          <select
            id="tag-category"
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isEditMode || isLoading}
          >
            {categories.length === 0 && (
              <option value="">No categories — create one first</option>
            )}
            {categories
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
          </select>
        </div>

        {/* Name */}
        <div className="tag-form__field">
          <label className="tag-form__label" htmlFor="tag-name">
            Name
          </label>
          <input
            id="tag-name"
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hall A, Crew 1, Flooring"
            maxLength={40}
            autoFocus
          />
        </div>

        {/* Color */}
        <div className="tag-form__field">
          <span className="tag-form__label">Color</span>
          <div className="tag-form__color-grid">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`tag-form__color-btn${color === c ? ' tag-form__color-btn--selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        {/* Sequencable toggle */}
        <div className="tag-form__field tag-form__field--row">
          <label className="tag-form__label tag-form__label--inline" htmlFor="tag-sequencable">
            Include in execution sequence
          </label>
          <input
            id="tag-sequencable"
            type="checkbox"
            checked={sequencable}
            onChange={(e) => setSequencable(e.target.checked)}
            className="tag-form__checkbox"
          />
        </div>

        {/* Skill tag toggle */}
        <div className="tag-form__field tag-form__field--row">
          <label className="tag-form__label tag-form__label--inline" htmlFor="tag-skill">
            Include as skill
          </label>
          <input
            id="tag-skill"
            type="checkbox"
            checked={skillTag}
            onChange={(e) => setSkillTag(e.target.checked)}
            className="tag-form__checkbox"
          />
        </div>

        {error && (
          <p className="form-error" style={{ color: 'var(--color-error, #dc2626)', fontSize: 13 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || !name.trim() || !categoryId}
        >
          {submitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Tag'}
        </button>
      </form>
    </ActionSheet>
  );
}
