import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import { useTaskStore } from '../../lib/stores/task-store';
import type { WorkType } from '../../lib/types';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from '../../lib/hooks/useMediaQuery';
import { useWorkTypeListData } from './hooks/useWorkTypeListData';
import { useWorkTypeSelection } from './hooks/useWorkTypeSelection';
import { WorkTypeFilterBar, DEFAULT_WORK_TYPE_FILTERS, type WorkTypeFilters } from './WorkTypeFilterBar';
import { WorkTypeToolbar } from './WorkTypeToolbar';
import { WorkTypeTable } from './WorkTypeTable';
import { WorkTypeEditPanel } from './WorkTypeEditPanel';
import { WorkTypeListItem } from './WorkTypeListItem';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
import { DeleteWorkTypeConfirm } from '../../components/DeleteWorkTypeConfirm';
import { AlertDialog } from '../../components/AlertDialog';
import { ExportIcon, RulerIcon, TrashIcon, WarningIcon } from '../../components/icons';
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
import './settings-styles';

interface SettingsWorkTypesViewProps {
  onBack: () => void;
  onManageUnits?: () => void;
}

export function SettingsWorkTypesView({ onBack, onManageUnits }: SettingsWorkTypesViewProps) {
  const isDesktop = useMediaQuery(WORKSPACE_MIN_WIDTH);

  const { workTypes } = useWorkTypeStore();
  const { definitions: workUnitDefinitions } = useWorkUnitStore();
  const { tags } = useTagStore();
  const { tasks } = useTaskStore();

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const [filters, setFilters] = useState<WorkTypeFilters>(DEFAULT_WORK_TYPE_FILTERS);

  const { editableWorkTypes, unitOptions, tagOptions, displayedWorkTypes, usageByWorkTypeId } =
    useWorkTypeListData(workTypes, tagById, tasks, filters);

  const selection = useWorkTypeSelection(displayedWorkTypes);

  // ── Single-item CRUD ─────────────────────────────────────────
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [showWorkTypeForm, setShowWorkTypeForm] = useState(false); // mobile sheet
  const [deleteConfirmWorkType, setDeleteConfirmWorkType] = useState<WorkType | null>(null);

  const handleAddWorkType = () => {
    setEditingWorkType(null);
    setShowWorkTypeForm(true);
  };

  const handleAddWorkTypeDesktop = () => {
    setEditingWorkType(null); // open panel in create mode
    // For desktop we reuse editingWorkType = null with panel open flag
    setShowWorkTypeForm(true); // reuse flag as "panel open"
  };

  const handleEditWorkType = (wt: WorkType) => {
    if (!isDesktop && selection.selectionMode) {
      selection.toggleSelected(wt.id);
      return;
    }
    setEditingWorkType(wt);
    setShowWorkTypeForm(true);
  };

  const handleCloseForm = () => {
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

  const handleDeleteWorkTypeConfirmed = async () => {
    if (!deleteConfirmWorkType) return;
    await removeWorkType(deleteConfirmWorkType.id);
    setDeleteConfirmWorkType(null);
    if (editingWorkType?.id === deleteConfirmWorkType.id) handleCloseForm();
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
    workTypePreview?.items.map(({ item }) => ({ id: item.workUnit, label: item.workUnitLabel })) ?? null,
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
          setImportSummary(parsed.errors.map((e) => `Row ${e.row}: ${e.field} - ${e.message}`).join('; '));
          return;
        }
        const warningSummary = parsed.warnings.length > 0
          ? parsed.warnings.map((w) => `Row ${w.row}: ${w.message}`).join('; ')
          : null;
        if (parsed.items.length === 0) {
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

  const { selectionMode, selectedIds, showBulkConfirm, isBulkDeleting } = selection;
  const bulkCount = selectedIds.length;

  // ── Desktop layout ────────────────────────────────────────────
  if (isDesktop) {
    const panelOpen = showWorkTypeForm;
    return (
      <div className="swt-desktop">
        <div className="swt-page-header">
          <h1 className="swt-page-header__title">Work Types</h1>
          <p className="swt-page-header__subtitle">Add and manage reusable work categories for estimates</p>
        </div>

        <WorkTypeToolbar
          filters={filters}
          onChange={setFilters}
          unitOptions={unitOptions}
          tagOptions={tagOptions}
          onAdd={handleAddWorkTypeDesktop}
          onExport={handleExportWorkTypes}
          onImport={() => fileInputRef.current?.click()}
        />

        <div className="swt-desktop__pane">
          {editableWorkTypes.length === 0 ? (
            <div className="swt-desktop__table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                <RulerIcon className="empty-state__icon" aria-hidden />
                <p className="empty-state__heading">No work types yet</p>
                <p className="empty-state__text">Add one to get started.</p>
              </div>
            </div>
          ) : displayedWorkTypes.length === 0 ? (
            <div className="swt-desktop__table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="settings-view__empty">No work types match the current filters.</p>
            </div>
          ) : (
            <WorkTypeTable
              rows={displayedWorkTypes}
              usageByWorkTypeId={usageByWorkTypeId}
              tagById={tagById}
              selection={selection}
              editingId={editingWorkType?.id ?? null}
              onEdit={handleEditWorkType}
              onDelete={setDeleteConfirmWorkType}
            />
          )}

          {panelOpen && (
            <WorkTypeEditPanel
              workType={editingWorkType}
              onClose={handleCloseForm}
              onDelete={editingWorkType ? () => setDeleteConfirmWorkType(editingWorkType) : undefined}
            />
          )}
        </div>

        {/* Hidden import file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => { void handleFileChange(e); }}
        />

        {/* Import preview — shows inline below pane if active */}
        {(workTypePreview ?? importSummary) ? (
          <div style={{ marginTop: 16 }}>
            <WorkTypeImportCard
              summaryMessage={importSummary}
              fileInputRef={fileInputRef}
              onFileChange={(e) => { void handleFileChange(e); }}
              preview={workTypePreview}
              workUnitPreview={workUnitPreview}
              applyImportedUnitLabels={applyImportedUnitLabels}
              onToggleApplyImportedUnitLabels={setApplyImportedUnitLabels}
              isLoadingPreview={isLoadingPreview}
              isApplying={isApplyingImport}
              onApply={() => { void handleApplyImport(); }}
            />
          </div>
        ) : null}

        <DeleteWorkTypeConfirm
          isOpen={!!deleteConfirmWorkType}
          workTypeTitle={deleteConfirmWorkType?.title ?? ''}
          onConfirm={() => { void handleDeleteWorkTypeConfirmed(); }}
          onCancel={() => setDeleteConfirmWorkType(null)}
        />

        <AlertDialog
          isOpen={showBulkConfirm}
          tone="danger"
          title={`Delete ${bulkCount} work ${bulkCount === 1 ? 'type' : 'types'}?`}
          titleIcon={<WarningIcon className="alert-dialog__icon" />}
          description={`Permanently delete ${bulkCount} work ${bulkCount === 1 ? 'type' : 'types'}.`}
          onClose={selection.closeBulkConfirm}
          ariaLabelledBy="bulk-delete-wt-title"
          ariaDescribedBy="bulk-delete-wt-desc"
          actions={[
            { label: 'Cancel', onClick: selection.closeBulkConfirm, variant: 'secondary' },
            {
              label: isBulkDeleting ? 'Deleting…' : `Delete ${bulkCount}`,
              onClick: () => { void selection.handleBulkDeleteConfirmed(); },
              variant: 'danger',
              icon: <TrashIcon className="alert-dialog__icon alert-dialog__icon--sm" />,
              disabled: isBulkDeleting,
            },
          ]}
        >
          <p className="alert-dialog__warning">This cannot be undone.</p>
        </AlertDialog>
      </div>
    );
  }

  // ── Mobile layout (unchanged) ────────────────────────────────
  return (
    <SettingsDetailLayout title="Work Types" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Work Types</h2>
          <div className="wt-header-actions">
            {editableWorkTypes.length > 1 && (
              selectionMode ? (
                <button type="button" className="btn btn--secondary btn--sm" onClick={selection.exitSelectionMode}>
                  Cancel
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--sm" onClick={selection.enterSelectionMode}>
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
          <button type="button" className="btn btn--secondary btn--sm" onClick={onManageUnits} style={{ marginBottom: 12 }}>
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
                checked={selection.visibleAllSelected}
                onChange={selection.selectAllVisible}
                aria-label="Select all visible work types"
              />
              <span>{selection.visibleAllSelected ? 'Deselect all' : 'Select all'}</span>
            </label>
            {bulkCount > 0 && <span className="wt-selection-bar__count">{bulkCount} selected</span>}
            {bulkCount > 0 && (
              <button type="button" className="btn btn--danger btn--sm" onClick={selection.openBulkConfirm}>
                <TrashIcon className="wt-selection-bar__trash-icon" />
                Delete ({bulkCount})
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
            {displayedWorkTypes.map((wt) => (
              <WorkTypeListItem
                key={wt.id}
                wt={wt}
                usageCount={usageByWorkTypeId.get(wt.id) ?? 0}
                tagById={tagById}
                selectionMode={selectionMode}
                isSelected={selectedIds.includes(wt.id)}
                onToggleSelect={selection.toggleSelected}
                onEdit={handleEditWorkType}
                onDelete={setDeleteConfirmWorkType}
              />
            ))}
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
        onFileChange={(e) => { void handleFileChange(e); }}
        preview={workTypePreview}
        workUnitPreview={workUnitPreview}
        applyImportedUnitLabels={applyImportedUnitLabels}
        onToggleApplyImportedUnitLabels={setApplyImportedUnitLabels}
        isLoadingPreview={isLoadingPreview}
        isApplying={isApplyingImport}
        onApply={() => { void handleApplyImport(); }}
      />

      <WorkTypeFormSheet
        isOpen={showWorkTypeForm}
        onClose={handleCloseForm}
        workType={editingWorkType}
        onDelete={editingWorkType ? () => setDeleteConfirmWorkType(editingWorkType) : undefined}
      />

      <DeleteWorkTypeConfirm
        isOpen={!!deleteConfirmWorkType}
        workTypeTitle={deleteConfirmWorkType?.title ?? ''}
        onConfirm={() => { void handleDeleteWorkTypeConfirmed(); }}
        onCancel={() => setDeleteConfirmWorkType(null)}
      />

      <AlertDialog
        isOpen={showBulkConfirm}
        tone="danger"
        title={`Delete ${bulkCount} work ${bulkCount === 1 ? 'type' : 'types'}?`}
        titleIcon={<WarningIcon className="alert-dialog__icon" />}
        description={`Permanently delete ${bulkCount} work ${bulkCount === 1 ? 'type' : 'types'}.`}
        onClose={selection.closeBulkConfirm}
        ariaLabelledBy="bulk-delete-wt-title"
        ariaDescribedBy="bulk-delete-wt-desc"
        actions={[
          { label: 'Cancel', onClick: selection.closeBulkConfirm, variant: 'secondary' },
          {
            label: isBulkDeleting ? 'Deleting…' : `Delete ${bulkCount}`,
            onClick: () => { void selection.handleBulkDeleteConfirmed(); },
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
