import { useRef, useState, type ChangeEvent } from 'react';
import { ImportIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { downloadCsv } from '../../lib/interop/download-csv';
import {
  parsePlanLineItemCsv,
  exportPlanLineItemCsvSample,
  type PlanLineItemImportParseResult,
} from '../../lib/interop/plan-line-item-import';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import './settings-styles';

interface SettingsPlanLineItemsViewProps {
  onBack: () => void;
}

export function SettingsPlanLineItemsView({ onBack }: SettingsPlanLineItemsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<PlanLineItemImportParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownloadSample = () => {
    downloadCsv('plan-work-packages-sample.csv', exportPlanLineItemCsvSample());
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsLoading(true);
    setParseResult(null);
    try {
      const text = await file.text();
      setParseResult(parsePlanLineItemCsv(text));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SettingsDetailLayout title="Plan Work Packages" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">CSV Format</h2>
        </div>
        <p className="settings-view__helper">
          One row per work package. Both assembly and dismantle phases in a single row.
        </p>
        <p className="settings-view__helper">
          Required: <code>title</code>, <code>workTypeTitle</code>, <code>workUnit</code> (<code>m2</code> / <code>m</code> / <code>pcs</code> / <code>orders</code>)
        </p>
        <p className="settings-view__helper">
          Optional: <code>workQuantity</code>, <code>assemblyRate</code>, <code>assemblyCrew</code>, <code>assemblyEstimatedMinutes</code>, <code>dismantleRate</code>, <code>dismantleCrew</code>, <code>dismantleEstimatedMinutes</code>
        </p>
        <button type="button" className="btn btn--secondary btn--sm" onClick={handleDownloadSample}>
          Download Sample CSV
        </button>
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Validate CSV</h2>
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel={isLoading ? 'Loading...' : 'Choose CSV file'}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          />
        </div>
        <p className="settings-view__helper">
          Check a CSV file against the expected format before importing it into a plan.
          To import, open a plan and use the <strong>Import CSV</strong> button in the Work Packages section.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {parseResult && (
          <div style={{ marginTop: 12 }}>
            {parseResult.valid ? (
              <p className="settings-view__helper">
                {parseResult.items.length} work package{parseResult.items.length !== 1 ? 's' : ''} ready to import.
              </p>
            ) : (
              <>
                <p className="settings-view__helper">
                  {parseResult.items.length > 0
                    ? `${parseResult.items.length} valid row${parseResult.items.length !== 1 ? 's' : ''}, ${parseResult.errors.length} error${parseResult.errors.length !== 1 ? 's' : ''}.`
                    : `${parseResult.errors.length} error${parseResult.errors.length !== 1 ? 's' : ''} — no valid rows.`}
                </p>
                <ul className="settings-view__helper" style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                  {parseResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.field} — {err.message}</li>
                  ))}
                  {parseResult.errors.length > 5 && (
                    <li>…and {parseResult.errors.length - 5} more</li>
                  )}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </SettingsDetailLayout>
  );
}
