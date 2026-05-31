import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import { useTaskStore } from '../../lib/stores/task-store';
import type { WorkType } from '../../lib/types';
import { resolveWorkUnitLabel } from '../../lib/types';
import {
  WorkTypeFilterBar,
  DEFAULT_WORK_TYPE_FILTERS,
  type WorkTypeFilters,
  type TagOption,
} from './WorkTypeFilterBar';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
import { DeleteWorkTypeConfirm } from '../../components/DeleteWorkTypeConfirm';
import { AlertDialog } from '../../components/AlertDialog';
import { ExportIcon, PencilIcon, RulerIcon, TrashIcon, WarningIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { exportWorkTypesCsv } from '../../lib/interop/work-type-export';
import { downloadCsv } from '../../lib/interop/download-csv';
import {
  applyWorkTypeImport,
  generateWorkTypeImportPreview,
  parseWorkTypeCsv,
  type WorkTypeImportPreview,
} from '../../lib/interop/work-type-import';
import { WorkTypeImportCard } from './WorkTypeImportCard';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';
import { useTagStore } from '../../lib/stores/tag-store';
import { TagPill } from '../../components/TagPill';
import './settings-styles';

interface SettingsWorkTypesViewProps {
  onBack: () => void;
  onManageUnits?: () => void;
}

export function SettingsWorkTypesView({ onBack, onManageUnits }: SettingsWorkTypesViewProps) {
  const { workTypes } = useWorkTypeStore();
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const { tags } = useTagStore();
  const { tasks } = useTaskStore();

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const editableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );

  // ── Usage counts ─────────────────────────────────────────────
  const usageByWorkTypeId = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.archivedAt !== null || !task.workTypeId) continue;
      map.set(task.workTypeId, (map.get(task.workTypeId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  // ── Filter / sort state ───────────────────────────────────────
  const [filters, setFilters] = useState<WorkTypeFilters>(DEFAULT_WORK_TYPE_FILTERS);

  const unitOptions = useMemo(() => {
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
          wt.tagIds?.some((id) => tagSet.has(id)) || (wt.skillTagId && tagSet.has(wt.skillTagId)),
      );
    }

    const sorted = [...result];
    if (filters.sortOrder === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (filters.sortOrder === 'za') sorted.sort((a, b) => b.title.localeCompare(a.title));
    else sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return sorted;
  }, [editableWorkTypes, filters]);

  // ── Selection / bulk delete state ────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds([]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    const visibleIds = displayedWorkTypes.map((wt) => wt.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  const visibleAllSelected =
    displayedWorkTypes.length > 0 &&
    displayedWorkTypes.every((wt) => selectedIds.includes(wt.id));

  async function handleBulkDeleteConfirmed() {
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => removeWorkType(id)));
    } finally {
      setIsBulkDeleting(false);
      setShowBulkConfirm(false);
      exitSelectionMode();
    }
  }

  // ── Single-item CRUD ─────────────────────────────────────────
  const [showWorkTypeForm, setShowWorkTypeForm] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [deleteConfirmWorkType, setDeleteConfirmWorkType] = useState<WorkType | null>(null);

  const handleAddWorkType = () => {
    setEditingWorkType(null);
    setShowWorkTypeForm(true);
  };

  const handleEditWorkType = (wt: WorkType) => {
    if (selectionMode) {
      toggleSelected(wt.id);
      return;
    }
    setEditingWorkType(wt);
    setShowWorkTypeForm(true);
  };

  const handleCloseWorkTypeForm = () => {
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

  const handleDeleteWorkTypeConfirmed = async () => {
    if (!deleteConfirmWorkType) return;
    await removeWorkType(deleteConfirmWorkType.id);
    setDeleteConfirmWorkType(null);
    if (editingWorkType?.id === deleteConfirmWorkType.id) {
      setShowWorkTypeForm(false);
      setEditingWorkType(null);
    }
  };

  // ── Export / import ──────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [workTypePreview, setWorkTypePreview] = useState<WorkTypeImportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    preview: workUnitPreview,
    applyImportedLabels: applyImportedUnitLabels,
    setApplyImportedLabels: setApplyImportedUnitLabels,
  } = useWorkUnitImportPreview(
    workTypePreview?.items.map(({ item }) => ({
      id: item.workUnit,
      label: item.workUnitLabel,
    })) ?? null,
    workUnitDefinitions,
  );

  const handleExportWorkTypes = () => {
    setIsExporting(true);
    try {
      const csv = exportWorkTypesCsv(editableWorkTypes);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`work-types-${stamp}.csv`, csv);
      setImportSummary(`Exported ${editableWorkTypes.length} work type definitions.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = '';
      setImportSummary(null);
      setWorkTypePreview(null);
      setIsLoadingPreview(true);

      try {
        const text = await file.text();
        const parsed = parseWorkTypeCsv(text);
        if (!parsed.valid) {
          setImportSummary(
            parsed.errors.map((e) => `Row ${e.row}: ${e.field} - ${e.message}`).join('; '),
          );
          return;
        }
        const warningSummary =
          parsed.warnings.length > 0
            ? parsed.warnings.map((w) => `Row ${w.row}: ${w.message}`).join('; ')
            : null;
        if (parsed.items.length === 0) {
          setWorkTypePreview(null);
          setImportSummary(warningSummary ?? 'No rows to import.');
          return;
        }
        setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, editableWorkTypes));
        setImportSummary(warningSummary);
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [editableWorkTypes],
  );

  const handleApplyImport = async () => {
    if (!workTypePreview) return;
    setIsApplyingImport(true);
    try {
      const result = await applyWorkTypeImport(
        workTypePreview.items.map((item) => item.item),
        { applyLabelToExisting: applyImportedUnitLabels },
      );
      setImportSummary(
        `Applied import: ${result.created} created, ${result.updated} updated, ${result.unitsCreated} unit${result.unitsCreated === 1 ? '' : 's'} added, ${result.unitLabelsUpdated} unit label${result.unitLabelsUpdated === 1 ? '' : 's'} updated.`,
      );
      setWorkTypePreview(null);
    } finally {
      setIsApplyingImport(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SettingsDetailLayout title="Work Types" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Work Types</h2>
          <div className="wt-header-actions">
            {editableWorkTypes.length > 1 && (
              selectionMode ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={exitSelectionMode}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={enterSelectionMode}
                >
                  Select
                </button>
              )
            )}
            {!selectionMode && (
              <button
                type="button"
                className="btn btn--primary btn--sm btn--circle"
                onClick={handleAddWorkType}
              >
                +
              </button>
            )}
          </div>
        </div>

        <p className="settings-view__helper">Add and manage work categories for estimates</p>

        {onManageUnits && !selectionMode && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onManageUnits}
            style={{ marginBottom: 12 }}
          >
            Manage units
          </button>
        )}

        {editableWorkTypes.length > 0 && (
          <WorkTypeFilterBar
            filters={filters}
            onChange={setFilters}
            unitOptions={unitOptions}
            tagOptions={tagOptions}
            totalCount={editableWorkTypes.length}
            filteredCount={displayedWorkTypes.length}
          />
        )}

        {selectionMode && displayedWorkTypes.length > 0 && (
          <div className="wt-selection-bar">
            <label className="wt-selection-bar__select-all">
              <input
                type="checkbox"
                checked={visibleAllSelected}
                onChange={selectAllVisible}
                aria-label="Select all visible work types"
              />
              <span>{visibleAllSelected ? 'Deselect all' : 'Select all'}</span>
            </label>
            {selectedIds.length > 0 && (
              <span className="wt-selection-bar__count">
                {selectedIds.length} selected
              </span>
            )}
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => setShowBulkConfirm(true)}
              >
                <TrashIcon className="wt-selection-bar__trash-icon" />
                Delete ({selectedIds.length})
              </button>
            )}
          </div>
        )}

        {editableWorkTypes.length === 0 ? (
          <div className="empty-state">
            <RulerIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No work types yet</p>
            <p className="empty-state__text">Add one to categorise tasks.</p>
          </div>
        ) : displayedWorkTypes.length === 0 ? (
          <p className="settings-view__empty">No work types match the current filters.</p>
        ) : (
          <div className="settings-view__list">
            {displayedWorkTypes.map((wt) => {
              const usageCount = usageByWorkTypeId.get(wt.id) ?? 0;
              const isSelected = selectedIds.includes(wt.id);
              return (
                <div
                  key={wt.id}
                  className={`settings-view__list-item${selectionMode ? ' settings-view__list-item--selectable' : ''}`}
                >
                  {selectionMode && (
                    <input
                      type="checkbox"
                      className="wt-row-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(wt.id)}
                      aria-label={`Select ${wt.title}`}
                    />
                  )}
                  <button
                    className={`settings-view__row${isSelected ? ' settings-view__row--selected' : ''}`}
                    onClick={() => handleEditWorkType(wt)}
                  >
                    <div className="settings-view__template-info">
                      <span className="settings-view__row-label">
                        {wt.title}
                        {usageCount > 0 && (
                          <span className="wt-usage-badge">
                            {usageCount} {usageCount === 1 ? 'task' : 'tasks'}
                          </span>
                        )}
                      </span>
                      <span className="settings-view__row-detail">
                        {resolveWorkUnitLabel(wt.workUnit)} · Assembly {wt.assemblyRate} · Dismantle{' '}
                        {wt.dismantleRate} {resolveWorkUnitLabel(wt.workUnit)}/person-hr
                      </span>
                      {wt.tagIds && wt.tagIds.length > 0 && (
                        <span className="settings-view__row-tags">
                          {wt.tagIds.map((id) => {
                            const tag = tagById.get(id);
                            return tag ? <TagPill key={id} tag={tag} /> : null;
                          })}
                        </span>
                      )}
                      {wt.skillTagId && (() => {
                        const skillTag = tagById.get(wt.skillTagId);
                        return skillTag ? (
                          <span className="settings-view__row-detail" style={{ fontSize: 12 }}>
                            Skill: <TagPill tag={skillTag} />
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </button>
                  {!selectionMode && (
                    <div className="settings-view__list-item-actions">
                      <IconButton
                        icon={<PencilIcon className="settings-detail__icon" />}
                        ariaLabel={`Edit work type ${wt.title}`}
                        onClick={() => handleEditWorkType(wt)}
                        variant="ghost"
                        className="icon-btn--edit"
                      />
                      <IconButton
                        icon={<TrashIcon className="settings-detail__icon" />}
                        ariaLabel={`Delete work type ${wt.title}`}
                        onClick={() => setDeleteConfirmWorkType(wt)}
                        variant="ghost"
                        className="icon-btn--danger"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Work Types</h2>
          <IconButton
            icon={<ExportIcon className="settings-view__export-icon" />}
            ariaLabel={isExporting ? 'Exporting...' : 'Export work types'}
            onClick={handleExportWorkTypes}
            disabled={isExporting}
          />
        </div>
        <p className="settings-view__helper">Export work type definitions as CSV.</p>
      </div>

      <WorkTypeImportCard
        summaryMessage={importSummary}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        preview={workTypePreview}
        workUnitPreview={workUnitPreview}
        applyImportedUnitLabels={applyImportedUnitLabels}
        onToggleApplyImportedUnitLabels={setApplyImportedUnitLabels}
        isLoadingPreview={isLoadingPreview}
        isApplying={isApplyingImport}
        onApply={() => {
          void handleApplyImport();
        }}
      />

      <WorkTypeFormSheet
        isOpen={showWorkTypeForm}
        onClose={handleCloseWorkTypeForm}
        workType={editingWorkType}
        onDelete={editingWorkType ? () => setDeleteConfirmWorkType(editingWorkType) : undefined}
      />

      <DeleteWorkTypeConfirm
        isOpen={!!deleteConfirmWorkType}
        workTypeTitle={deleteConfirmWorkType?.title ?? ''}
        onConfirm={() => {
          void handleDeleteWorkTypeConfirmed();
        }}
        onCancel={() => setDeleteConfirmWorkType(null)}
      />

      <AlertDialog
        isOpen={showBulkConfirm}
        tone="danger"
        title={`Delete ${selectedIds.length} work ${selectedIds.length === 1 ? 'type' : 'types'}?`}
        titleIcon={<WarningIcon className="alert-dialog__icon" />}
        description={`This will permanently delete ${selectedIds.length} work ${selectedIds.length === 1 ? 'type' : 'types'}.`}
        onClose={() => setShowBulkConfirm(false)}
        ariaLabelledBy="bulk-delete-wt-title"
        ariaDescribedBy="bulk-delete-wt-desc"
        actions={[
          { label: 'Cancel', onClick: () => setShowBulkConfirm(false), variant: 'secondary' },
          {
            label: isBulkDeleting ? 'Deleting…' : `Delete ${selectedIds.length}`,
            onClick: () => { void handleBulkDeleteConfirmed(); },
            variant: 'danger',
            icon: <TrashIcon className="alert-dialog__icon alert-dialog__icon--sm" />,
            disabled: isBulkDeleting,
          },
        ]}
      >
        <p className="alert-dialog__warning">This cannot be undone.</p>
      </AlertDialog>
    </SettingsDetailLayout>
  );
}
