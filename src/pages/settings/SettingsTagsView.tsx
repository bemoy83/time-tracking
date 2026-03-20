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

  async function handleTagSubmit(values: { name: string; color: string; categoryId: string; sequencable: boolean }) {
    if (editingTag) {
      await updateTagFields(editingTag.id, { name: values.name, color: values.color, sequencable: values.sequencable });
    } else {
      await createTag({ name: values.name, color: values.color, categoryId: values.categoryId, sequencable: values.sequencable });
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
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Tags</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--circle"
            onClick={openNewCategory}
          >
            +
          </button>
        </div>
        <p className="settings-view__helper">
          Tags classify work types and tasks for filtering and grouping. Organize tags into categories such as
          Resource, Location, or Team.
        </p>

        {categoriesWithTags.length === 0 ? (
          <div className="empty-state">
            <PencilIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No tag categories yet</p>
            <p className="empty-state__text">Add a category to organize tags.</p>
          </div>
        ) : (
          <div className="settings-view__tag-category-list">
            {categoriesWithTags.map(({ category, tags }) => (
              <div key={category.id} className="settings-view__tag-category">
                <div className="settings-view__list-item">
                  <button
                    type="button"
                    className="settings-view__row"
                    onClick={() => openEditCategory(category)}
                  >
                    <div className="settings-view__template-info">
                      <span className="settings-view__row-label">{category.name}</span>
                      <span className="settings-view__row-detail">
                        {tags.length === 0
                          ? 'No tags in this category'
                          : `${tags.length} tag${tags.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </button>
                  <div className="settings-view__list-item-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => openNewTag(category.id)}
                    >
                      + Tag
                    </button>
                    <IconButton
                      icon={<PencilIcon className="settings-detail__icon" />}
                      ariaLabel={`Edit category ${category.name}`}
                      onClick={() => openEditCategory(category)}
                      variant="ghost"
                    />
                    <IconButton
                      icon={<TrashIcon className="settings-detail__icon" />}
                      ariaLabel={`Delete category ${category.name}`}
                      onClick={() => setDeleteCategoryTarget(category)}
                      variant="ghost"
                    />
                  </div>
                </div>

                {tags.length === 0 ? (
                  <p className="settings-view__nested-empty">No tags in this category yet.</p>
                ) : (
                  <div className="settings-view__list settings-view__list--nested">
                    {tags.map((tag) => (
                      <div key={tag.id} className="settings-view__list-item">
                        <button
                          type="button"
                          className="settings-view__row"
                          onClick={() => openEditTag(tag)}
                        >
                          <div className="settings-view__template-info">
                            <span className="settings-view__row-label settings-view__row-label--with-dot">
                              <span
                                className="tag-settings__tag-dot"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </span>
                          </div>
                        </button>
                        <div className="settings-view__list-item-actions">
                          <IconButton
                            icon={<PencilIcon className="settings-detail__icon" />}
                            ariaLabel={`Edit tag ${tag.name}`}
                            onClick={() => openEditTag(tag)}
                            variant="ghost"
                          />
                          <IconButton
                            icon={<TrashIcon className="settings-detail__icon" />}
                            ariaLabel={`Delete tag ${tag.name}`}
                            onClick={() => setDeleteTagTarget(tag)}
                            variant="ghost"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
