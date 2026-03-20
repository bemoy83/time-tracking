import { useState } from 'react';
import {
  useTagStore,
  createTagCategory,
  updateTagCategoryFields,
  removeTagCategory,
  createTag,
  updateTagFields,
  removeTag,
  getCategoriesWithTags,
} from '../../lib/stores/tag-store';
import type { Tag, TagCategory } from '../../lib/tags';
import { TagFormSheet } from '../../components/TagFormSheet';
import { IconButton } from '../../components/IconButton';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { AlertDialog } from '../../components/AlertDialog';
import './settings-styles';

interface SettingsTagsViewProps {
  onBack: () => void;
}

export function SettingsTagsView({ onBack }: SettingsTagsViewProps) {
  useTagStore(); // subscribe to updates

  const categoriesWithTags = getCategoriesWithTags();

  // Tag form
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagFormCategoryId, setTagFormCategoryId] = useState('');

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Delete confirmations
  const [deleteTagTarget, setDeleteTagTarget] = useState<Tag | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<TagCategory | null>(null);

  // ---- Tag actions ----

  function openNewTag(categoryId: string) {
    setEditingTag(null);
    setTagFormCategoryId(categoryId);
    setShowTagForm(true);
  }

  function openEditTag(tag: Tag) {
    setEditingTag(tag);
    setTagFormCategoryId(tag.categoryId);
    setShowTagForm(true);
  }

  async function handleTagSubmit(values: { name: string; color: string; categoryId: string }) {
    if (editingTag) {
      await updateTagFields(editingTag.id, { name: values.name, color: values.color });
    } else {
      await createTag({ name: values.name, color: values.color, categoryId: values.categoryId });
    }
  }

  async function handleDeleteTag() {
    if (!deleteTagTarget) return;
    await removeTag(deleteTagTarget.id);
    setDeleteTagTarget(null);
  }

  // ---- Category actions ----

  function openNewCategory() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryError('');
    setShowCategoryForm(true);
  }

  function openEditCategory(category: TagCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryError('');
    setShowCategoryForm(true);
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    try {
      if (editingCategory) {
        await updateTagCategoryFields(editingCategory.id, { name: categoryName.trim() });
      } else {
        await createTagCategory({ name: categoryName.trim() });
      }
      setShowCategoryForm(false);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to save category');
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategoryTarget) return;
    await removeTagCategory(deleteCategoryTarget.id);
    setDeleteCategoryTarget(null);
  }

  return (
    <SettingsDetailLayout title="Tags" onBack={onBack}>
      <div className="settings-section">
        <p className="settings-section__description">
          Tags classify work types and tasks for filtering and grouping. Organize tags
          into categories such as Resource, Location, or Team.
        </p>

        {/* Categories + their tags */}
        {categoriesWithTags.length === 0 ? (
          <div className="settings-empty">
            <p>No tag categories yet. Create a category to get started.</p>
          </div>
        ) : (
          <div className="tag-settings__list">
            {categoriesWithTags.map(({ category, tags }) => (
              <div key={category.id} className="tag-settings__category">
                <div className="tag-settings__category-header">
                  <span className="tag-settings__category-name">{category.name}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => openNewTag(category.id)}
                    >
                      + Tag
                    </button>
                    <IconButton
                      icon={<PencilIcon />}
                      ariaLabel={`Edit category ${category.name}`}
                      onClick={() => openEditCategory(category)}
                      variant="ghost"
                    />
                    <IconButton
                      icon={<TrashIcon />}
                      ariaLabel={`Delete category ${category.name}`}
                      onClick={() => setDeleteCategoryTarget(category)}
                      variant="ghost"
                    />
                  </div>
                </div>

                {tags.length === 0 ? (
                  <div className="tag-settings__tag-row" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ fontSize: 13, fontStyle: 'italic' }}>No tags yet</span>
                  </div>
                ) : (
                  tags.map((tag) => (
                    <div key={tag.id} className="tag-settings__tag-row">
                      <span
                        className="tag-settings__tag-dot"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="tag-settings__tag-name">{tag.name}</span>
                      <div className="tag-settings__tag-actions">
                        <IconButton
                          icon={<PencilIcon />}
                          ariaLabel={`Edit tag ${tag.name}`}
                          onClick={() => openEditTag(tag)}
                          variant="ghost"
                        />
                        <IconButton
                          icon={<TrashIcon />}
                          ariaLabel={`Delete tag ${tag.name}`}
                          onClick={() => setDeleteTagTarget(tag)}
                          variant="ghost"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add category */}
        <div className="settings-add-row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={openNewCategory}
          >
            + Add Category
          </button>
        </div>
      </div>

      {/* Tag form */}
      <TagFormSheet
        isOpen={showTagForm}
        onClose={() => setShowTagForm(false)}
        editTag={editingTag ?? undefined}
        defaultCategoryId={tagFormCategoryId}
        onSubmit={handleTagSubmit}
      />

      {/* Category form (inline inline sheet) */}
      {showCategoryForm && (
        <div className="action-sheet__backdrop" onClick={() => setShowCategoryForm(false)}>
          <div
            className="action-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="action-sheet__header">
              <h2 className="action-sheet__title">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
            </div>
            <form
              className="tag-form"
              onSubmit={handleCategorySubmit}
            >
              <div className="tag-form__field">
                <label className="tag-form__label" htmlFor="category-name">
                  Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  className="input"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Resource, Location, Team"
                  maxLength={40}
                  autoFocus
                />
              </div>
              {categoryError && (
                <p style={{ color: 'var(--color-error, #dc2626)', fontSize: 13 }}>
                  {categoryError}
                </p>
              )}
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!categoryName.trim()}
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete tag confirmation */}
      <AlertDialog
        isOpen={deleteTagTarget != null}
        tone="danger"
        title={`Delete "${deleteTagTarget?.name}"?`}
        description="This tag will be removed from all work types and tasks that use it."
        actions={[
          { label: 'Cancel', onClick: () => setDeleteTagTarget(null), variant: 'secondary' },
          { label: 'Delete', onClick: handleDeleteTag, variant: 'danger' },
        ]}
        onClose={() => setDeleteTagTarget(null)}
      />

      {/* Delete category confirmation */}
      <AlertDialog
        isOpen={deleteCategoryTarget != null}
        tone="danger"
        title={`Delete category "${deleteCategoryTarget?.name}"?`}
        description="All tags in this category and their assignments will be permanently removed."
        actions={[
          { label: 'Cancel', onClick: () => setDeleteCategoryTarget(null), variant: 'secondary' },
          { label: 'Delete', onClick: handleDeleteCategory, variant: 'danger' },
        ]}
        onClose={() => setDeleteCategoryTarget(null)}
      />
    </SettingsDetailLayout>
  );
}
