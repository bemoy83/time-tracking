/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDataTransferView } from './SettingsDataTransferView';
import { useWorkUnitStore } from '../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../lib/hooks/useWorkUnitImportPreview';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../lib/interop/data-transfer/handoff-copy';
import {
  applyFullBackupImport,
  exportFullBackupToFile,
  parseFullBackupJson,
  previewFullBackupImport,
} from '../../lib/interop/data-transfer/full-backup';
import type { FullBackupImportPreview } from '../../lib/interop/data-transfer/contracts';

vi.mock('../../lib/stores/work-unit-store', () => ({
  useWorkUnitStore: vi.fn(),
}));

vi.mock('../../lib/hooks/useWorkUnitImportPreview', () => ({
  useWorkUnitImportPreview: vi.fn(),
}));

vi.mock('../../lib/interop/data-transfer/plan-package', () => ({
  applyPlanPackageImport: vi.fn(),
  parsePlanPackageJson: vi.fn(),
  previewPlanPackageImport: vi.fn(),
}));

vi.mock('../../lib/interop/data-transfer/execution-return-import', () => ({
  applyExecutionReturnImport: vi.fn(),
  formatExecutionReturnMergeSummary: vi.fn(() => 'merge summary'),
  parseExecutionReturnJson: vi.fn(),
  previewExecutionReturnImport: vi.fn(),
}));

vi.mock('../../lib/interop/data-transfer/full-backup', () => ({
  applyFullBackupImport: vi.fn(),
  exportFullBackupToFile: vi.fn(),
  parseFullBackupJson: vi.fn(),
  previewFullBackupImport: vi.fn(),
}));

vi.mock('../../lib/telemetry/telemetry', () => ({
  trackTelemetryEvent: vi.fn(),
}));

const mockedUseWorkUnitStore = vi.mocked(useWorkUnitStore);
const mockedUseWorkUnitImportPreview = vi.mocked(useWorkUnitImportPreview);
const mockedExportFullBackupToFile = vi.mocked(exportFullBackupToFile);
const mockedParseFullBackupJson = vi.mocked(parseFullBackupJson);
const mockedPreviewFullBackupImport = vi.mocked(previewFullBackupImport);
const mockedApplyFullBackupImport = vi.mocked(applyFullBackupImport);

function makeFullBackupPreview(
  overrides: Partial<FullBackupImportPreview> = {},
): FullBackupImportPreview {
  return {
    exportedAt: '2026-03-22T10:00:00.000Z',
    schemaVersion: '4.0',
    appVersion: '0.0.1',
    snapshotFormatVersion: 1,
    idbSchemaVersion: 38,
    counts: {
      activeTimers: 1,
      timeEntries: 2,
      tasks: 3,
      projects: 1,
      taskNotes: 1,
      templateNotes: 1,
      taskTemplates: 1,
      attributionSnapshots: 1,
      plans: 1,
      workTypes: 2,
      workUnitDefinitions: 1,
      executionReturns: 1,
      executionReturnLineItems: 2,
      executionReturnUnplannedTasks: 1,
      tagCategories: 1,
      tags: 2,
      globalTagSequence: 1,
      crewPool: 1,
    },
    warnings: [],
    isCompatible: true,
    envelope: {
      schemaVersion: '4.0',
      exportType: 'full-backup',
      exportedAt: '2026-03-22T10:00:00.000Z',
      appVersion: '0.0.1',
      payload: {} as never,
    },
    ...overrides,
  };
}

describe('SettingsDataTransferView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.scrollTo = vi.fn();

    mockedUseWorkUnitStore.mockReturnValue({
      definitions: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useWorkUnitStore>);

    mockedUseWorkUnitImportPreview.mockReturnValue({
      preview: null,
      applyImportedLabels: false,
      setApplyImportedLabels: vi.fn(),
    });

    mockedParseFullBackupJson.mockReturnValue({
      ok: true,
      envelope: {
        schemaVersion: '4.0',
        exportType: 'full-backup',
        exportedAt: '2026-03-22T10:00:00.000Z',
        appVersion: '0.0.1',
        payload: {} as never,
      },
    });

    mockedPreviewFullBackupImport.mockResolvedValue(makeFullBackupPreview());
    mockedApplyFullBackupImport.mockResolvedValue({
      restoredAt: '2026-03-22T10:15:00.000Z',
      counts: makeFullBackupPreview().counts,
      reason: 'Imported full backup. The page will reload.',
    });
  });

  it('renders the backup cards and explains execution return handoff', () => {
    render(<SettingsDataTransferView onBack={vi.fn()} />);

    expect(screen.getByText('Export Full Backup')).toBeTruthy();
    expect(screen.getByText('Import Full Backup')).toBeTruthy();
    expect(screen.getByText('Import Execution Return')).toBeTruthy();
    expect(screen.getByText(new RegExp(PLANNER_EXECUTION_RETURN_EXPLANATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
    expect(screen.getByText(new RegExp(CANONICAL_HANDOFF_EXPLANATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
  });

  it('invokes full-backup export', async () => {
    render(<SettingsDataTransferView onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export full backup' }));

    await waitFor(() => {
      expect(mockedExportFullBackupToFile).toHaveBeenCalledTimes(1);
    });
  });

  it('shows destructive confirmation copy and disables restore when preview is incompatible', async () => {
    mockedPreviewFullBackupImport.mockResolvedValue(makeFullBackupPreview({
      isCompatible: false,
      warnings: ['This backup targets IndexedDB schema 37, but this app uses schema 38. Import is blocked.'],
      idbSchemaVersion: 37,
    }));

    const { container } = render(<SettingsDataTransferView onBack={vi.fn()} />);
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    fireEvent.change(inputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Review Restore')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Review Restore'));

    expect(screen.getByText('This full backup import is irreversible. It replaces everything on this device and reloads the page after restore.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Replace All Data' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('imports a full backup and reloads the page after confirmation', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    const { container } = render(<SettingsDataTransferView onBack={vi.fn()} />);
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    fireEvent.change(inputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Review Restore')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Review Restore'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));

    await waitFor(() => {
      expect(mockedApplyFullBackupImport).toHaveBeenCalledTimes(1);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
