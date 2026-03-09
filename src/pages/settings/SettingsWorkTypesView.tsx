import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import type { WorkType } from '../../lib/types';
import { WORK_UNIT_LABELS } from '../../lib/types';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
import { ExportIcon, RulerIcon } from '../../components/icons';
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

interface SettingsWorkTypesViewProps {
  onBack: () => void;
}

export function SettingsWorkTypesView({ onBack }: SettingsWorkTypesViewProps) {
  const { workTypes } = useWorkTypeStore();
  const editableWorkTypes = workTypes.filter((wt) => wt.readOnly !== true);
  const [showWorkTypeForm, setShowWorkTypeForm] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [workTypePreview, setWorkTypePreview] = useState<WorkTypeImportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddWorkType = () => {
    setEditingWorkType(null);
    setShowWorkTypeForm(true);
  };

  const handleEditWorkType = (wt: WorkType) => {
    setEditingWorkType(wt);
    setShowWorkTypeForm(true);
  };

  const handleCloseWorkTypeForm = () => {
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

  const handleDeleteWorkType = async () => {
    if (!editingWorkType) return;
    await removeWorkType(editingWorkType.id);
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

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
        setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, editableWorkTypes));
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
      const result = await applyWorkTypeImport(workTypePreview.items.map((item) => item.item));
      setImportSummary(`Applied import: ${result.created} created, ${result.updated} updated.`);
      setWorkTypePreview(null);
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <SettingsDetailLayout title="Work Types" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Work Types</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--circle"
            onClick={handleAddWorkType}
          >
            +
          </button>
        </div>
        <p className="settings-view__helper">Add and manage work categories for estimates</p>

        {editableWorkTypes.length === 0 ? (
          <div className="empty-state">
            <RulerIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No work types yet</p>
            <p className="empty-state__text">Add one to categorise tasks.</p>
          </div>
        ) : (
          <div className="settings-view__list">
            {editableWorkTypes.map((wt) => (
              <button
                key={wt.id}
                className="settings-view__row"
                onClick={() => handleEditWorkType(wt)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{wt.title}</span>
                  <span className="settings-view__row-detail">
                    {WORK_UNIT_LABELS[wt.workUnit]} · BU {wt.buildUpRate} · TD {wt.tearDownRate} {WORK_UNIT_LABELS[wt.workUnit]}/person-hr
                  </span>
                </div>
              </button>
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
        onFileChange={handleFileChange}
        preview={workTypePreview}
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
        onDelete={editingWorkType ? handleDeleteWorkType : undefined}
      />
    </SettingsDetailLayout>
  );
}
