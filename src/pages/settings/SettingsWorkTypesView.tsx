import { useState } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import type { WorkType } from '../../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../../lib/types';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
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
  const [workTypeCsvInput, setWorkTypeCsvInput] = useState('');
  const [workTypeParseErrors, setWorkTypeParseErrors] = useState<string[]>([]);
  const [workTypePreview, setWorkTypePreview] = useState<WorkTypeImportPreview | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

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

  const handleParseWorkTypes = () => {
    const parsed = parseWorkTypeCsv(workTypeCsvInput);
    if (!parsed.valid) {
      setWorkTypePreview(null);
      setWorkTypeParseErrors(parsed.errors.map((error) => `Row ${error.row}: ${error.field} - ${error.message}`));
      return;
    }

    setWorkTypeParseErrors([]);
    setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, editableWorkTypes));
  };

  const handleApplyImport = async () => {
    if (!workTypePreview) return;
    setIsApplyingImport(true);
    try {
      const result = await applyWorkTypeImport(workTypePreview.items.map((item) => item.item));
      setImportSummary(`Applied import: ${result.created} created, ${result.updated} updated.`);
      setWorkTypePreview(null);
      setWorkTypeCsvInput('');
      setWorkTypeParseErrors([]);
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
            className="btn btn--primary btn--sm"
            onClick={handleAddWorkType}
          >
            + Add
          </button>
        </div>
        <p className="settings-view__helper">Add and manage work categories for estimates</p>

        {editableWorkTypes.length === 0 ? (
          <p className="settings-view__empty">No work types yet. Add one to categorise tasks.</p>
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
                    {BUILD_PHASE_LABELS[wt.buildPhase]} · {WORK_UNIT_LABELS[wt.workUnit]} · {wt.expectedProductivity} {WORK_UNIT_LABELS[wt.workUnit]}/person-hr
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
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleExportWorkTypes}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
        <p className="settings-view__helper">Export work type definitions as CSV.</p>
      </div>

      <WorkTypeImportCard
        summaryMessage={importSummary}
        csvInput={workTypeCsvInput}
        onCsvInputChange={setWorkTypeCsvInput}
        onParse={handleParseWorkTypes}
        parseErrors={workTypeParseErrors}
        preview={workTypePreview}
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
