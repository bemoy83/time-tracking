import { useRef, useState, type ChangeEvent } from 'react';
import { AlertDialog } from '../../../components/AlertDialog';
import { ExportIcon, ImportIcon } from '../../../components/icons';
import { IconButton } from '../../../components/IconButton';
import type {
  FullBackupEntityCounts,
  FullBackupImportPreview,
} from '../../../lib/interop/data-transfer/contracts';
import {
  applyFullBackupImport,
  exportFullBackupToFile,
  parseFullBackupJson,
  previewFullBackupImport,
} from '../../../lib/interop/data-transfer/full-backup';
import { trackTelemetryEvent } from '../../../lib/telemetry/telemetry';

function sumBackupCounts(counts: FullBackupEntityCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function formatBackupSummary(counts: FullBackupEntityCounts): string {
  return [
    `${counts.tasks} tasks`,
    `${counts.timeEntries} time entries`,
    `${counts.plans} plans`,
    `${counts.workTypes} work types`,
    `${counts.tags} tags`,
    `${counts.taskNotes + counts.templateNotes} notes`,
  ].join(' · ');
}

export function FullBackupTransferCard() {
  const fullBackupFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingFullBackup, setIsExportingFullBackup] = useState(false);
  const [isLoadingFullBackupPreview, setIsLoadingFullBackupPreview] = useState(false);
  const [fullBackupPreview, setFullBackupPreview] = useState<FullBackupImportPreview | null>(null);
  const [fullBackupMessage, setFullBackupMessage] = useState<string | null>(null);
  const [isApplyingFullBackupImport, setIsApplyingFullBackupImport] = useState(false);
  const [isFullBackupConfirmOpen, setIsFullBackupConfirmOpen] = useState(false);

  const handleExportFullBackup = async () => {
    setIsExportingFullBackup(true);
    setFullBackupMessage(null);
    try {
      await exportFullBackupToFile();
      setFullBackupMessage('Full backup exported.');
      trackTelemetryEvent('interop_full_backup_export');
    } catch {
      setFullBackupMessage('Failed to export full backup.');
    } finally {
      setIsExportingFullBackup(false);
    }
  };

  const handleFullBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setFullBackupMessage(null);
    setFullBackupPreview(null);
    setIsFullBackupConfirmOpen(false);
    setIsLoadingFullBackupPreview(true);

    try {
      const text = await file.text();
      const parsed = parseFullBackupJson(text);
      if (!parsed.ok) {
        setFullBackupMessage(parsed.error);
        return;
      }
      const nextPreview = await previewFullBackupImport(parsed.envelope);
      setFullBackupPreview(nextPreview);
    } finally {
      setIsLoadingFullBackupPreview(false);
    }
  };

  const handleApplyFullBackupImport = async () => {
    if (!fullBackupPreview) return;
    setIsApplyingFullBackupImport(true);
    try {
      const result = await applyFullBackupImport(fullBackupPreview);
      setFullBackupMessage(result.reason);
      setIsFullBackupConfirmOpen(false);
      setFullBackupPreview(null);
      trackTelemetryEvent('interop_full_backup_import');
      window.location.reload();
    } catch (error) {
      setFullBackupMessage(error instanceof Error ? error.message : 'Failed to import full backup.');
    } finally {
      setIsApplyingFullBackupImport(false);
    }
  };

  return (
    <>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Full Backup</h2>
          <IconButton
            icon={<ExportIcon className="settings-view__export-icon" />}
            ariaLabel={isExportingFullBackup ? 'Exporting...' : 'Export full backup'}
            onClick={() => {
              void handleExportFullBackup();
            }}
            disabled={isExportingFullBackup || isApplyingFullBackupImport}
          />
        </div>
        <p className="settings-view__helper">
          Export the entire local database for backup, browser migration, or disaster recovery.
        </p>
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Import Full Backup</h2>
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel={isLoadingFullBackupPreview ? 'Reading...' : 'Choose backup JSON'}
            onClick={() => fullBackupFileInputRef.current?.click()}
            disabled={isLoadingFullBackupPreview || isApplyingFullBackupImport || isExportingFullBackup}
          />
        </div>
        <p className="settings-view__helper">
          Restore a complete backup and replace every local record on this device.
        </p>
        <p className="settings-view__helper">
          This is irreversible. After a successful restore, the page reloads so every in-memory store re-reads IndexedDB.
        </p>
        <input
          ref={fullBackupFileInputRef}
          type="file"
          accept=".json,application/json"
          aria-label="Import full backup file"
          style={{ display: 'none' }}
          onChange={handleFullBackupFileChange}
        />

        {fullBackupPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              <strong>18 stores</strong> · {sumBackupCounts(fullBackupPreview.counts)} records
            </div>
            <div className="settings-view__row-detail">
              {formatBackupSummary(fullBackupPreview.counts)}
            </div>
            <div className="settings-view__row-detail">
              Exported: {new Date(fullBackupPreview.exportedAt).toLocaleString()}
            </div>
            <div className="settings-view__row-detail">
              Snapshot format v{fullBackupPreview.snapshotFormatVersion} · IndexedDB schema {fullBackupPreview.idbSchemaVersion}
            </div>
            <div className="settings-view__row-detail">
              Execution returns: {fullBackupPreview.counts.executionReturns} envelopes · {fullBackupPreview.counts.executionReturnLineItems} line items · {fullBackupPreview.counts.executionReturnUnplannedTasks} unplanned task snapshots
            </div>
            <div className="settings-view__row-detail">
              Singletons: {fullBackupPreview.counts.globalTagSequence} global tag sequence · {fullBackupPreview.counts.crewPool} crew pool
            </div>
            {fullBackupPreview.warnings.map((warning) => (
              <div key={warning} className="settings-view__row-detail">
                {warning}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => setIsFullBackupConfirmOpen(true)}
                disabled={isApplyingFullBackupImport}
              >
                Review Restore
              </button>
            </div>
          </div>
        )}

        {fullBackupMessage && (
          <p className="settings-view__helper" style={{ marginTop: 12 }}>
            {fullBackupMessage}
          </p>
        )}
      </div>

      <AlertDialog
        isOpen={isFullBackupConfirmOpen}
        tone="danger"
        title="Replace all local data?"
        description="This full backup import is irreversible. It replaces everything on this device and reloads the page after restore."
        onClose={() => {
          if (isApplyingFullBackupImport) return;
          setIsFullBackupConfirmOpen(false);
        }}
        ariaLabelledBy="full-backup-confirm-title"
        ariaDescribedBy="full-backup-confirm-desc"
        actions={[
          {
            label: 'Cancel',
            onClick: () => setIsFullBackupConfirmOpen(false),
            variant: 'secondary',
            disabled: isApplyingFullBackupImport,
          },
          {
            label: isApplyingFullBackupImport ? 'Restoring...' : 'Replace All Data',
            onClick: () => {
              void handleApplyFullBackupImport();
            },
            variant: 'danger',
            disabled: isApplyingFullBackupImport || !fullBackupPreview?.isCompatible,
          },
        ]}
      >
        {fullBackupPreview && (
          <div className="settings-view__list" style={{ marginTop: 12 }}>
            <div className="settings-view__row-detail">
              Backup summary: {formatBackupSummary(fullBackupPreview.counts)}
            </div>
            <div className="settings-view__row-detail">
              Total records: {sumBackupCounts(fullBackupPreview.counts)}
            </div>
            {!fullBackupPreview.isCompatible && fullBackupPreview.warnings.map((warning) => (
              <div key={warning} className="settings-view__row-detail">
                {warning}
              </div>
            ))}
          </div>
        )}
      </AlertDialog>
    </>
  );
}
