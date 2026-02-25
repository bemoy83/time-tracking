import { useState } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import type { WorkType } from '../../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../../lib/types';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { exportWorkTypesCsv } from '../../lib/interop/work-type-export';
import {
  applyWorkTypeImport,
  generateWorkTypeImportPreview,
  parseWorkTypeCsv,
  type WorkTypeImportPreview,
} from '../../lib/interop/work-type-import';

interface SettingsWorkTypesViewProps {
  onBack: () => void;
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SettingsWorkTypesView({ onBack }: SettingsWorkTypesViewProps) {
  const { workTypes } = useWorkTypeStore();
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
      const csv = exportWorkTypesCsv(workTypes);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`work-types-${stamp}.csv`, csv);
      setImportSummary(`Exported ${workTypes.length} work type definitions.`);
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
    setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, workTypes));
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

        {workTypes.length === 0 ? (
          <p className="settings-view__empty">No work types yet. Add one to categorise tasks.</p>
        ) : (
          <div className="settings-view__list">
            {workTypes.map((wt) => (
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

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Work Types</h2>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleParseWorkTypes}>
            Parse + Preview
          </button>
        </div>
        <p className="settings-view__helper">Paste CSV (title, workUnit, buildPhase, expectedProductivity)</p>
        <textarea
          className="input"
          rows={8}
          value={workTypeCsvInput}
          onChange={(event) => setWorkTypeCsvInput(event.target.value)}
          placeholder="title,workUnit,buildPhase,expectedProductivity"
        />

        {workTypeParseErrors.length > 0 && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            {workTypeParseErrors.slice(0, 8).map((error) => (
              <div key={error} className="settings-view__row-detail">{error}</div>
            ))}
          </div>
        )}

        {workTypePreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              {workTypePreview.summary.create} create · {workTypePreview.summary.update} update
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isApplyingImport}
              onClick={() => {
                void handleApplyImport();
              }}
            >
              {isApplyingImport ? 'Applying...' : 'Apply Import'}
            </button>
          </div>
        )}

        {importSummary && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {importSummary}
          </p>
        )}
      </div>

      <WorkTypeFormSheet
        isOpen={showWorkTypeForm}
        onClose={handleCloseWorkTypeForm}
        workType={editingWorkType}
        onDelete={editingWorkType ? handleDeleteWorkType : undefined}
      />
    </SettingsDetailLayout>
  );
}
