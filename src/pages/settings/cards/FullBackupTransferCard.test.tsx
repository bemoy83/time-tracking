/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FullBackupTransferCard } from './FullBackupTransferCard';
import {
  applyFullBackupImport,
  exportFullBackupToFile,
  parseFullBackupJson,
  previewFullBackupImport,
} from '../../../lib/interop/data-transfer/full-backup';
import type { FullBackupImportPreview } from '../../../lib/interop/data-transfer/contracts';

vi.mock('../../../lib/interop/data-transfer/full-backup', () => ({
  applyFullBackupImport: vi.fn(),
  exportFullBackupToFile: vi.fn(),
  parseFullBackupJson: vi.fn(),
  previewFullBackupImport: vi.fn(),
}));

vi.mock('../../../lib/telemetry/telemetry', () => ({
  trackTelemetryEvent: vi.fn(),
}));

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

describe('FullBackupTransferCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.scrollTo = vi.fn();

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

  it('exports a full backup', async () => {
    render(<FullBackupTransferCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Export full backup' }));

    await waitFor(() => {
      expect(mockedExportFullBackupToFile).toHaveBeenCalledTimes(1);
    });
  });

  it('uses a labeled hidden file input and blocks incompatible restore confirmation', async () => {
    mockedPreviewFullBackupImport.mockResolvedValue(makeFullBackupPreview({
      isCompatible: false,
      warnings: ['This backup targets IndexedDB schema 37, but this app uses schema 38. Import is blocked.'],
      idbSchemaVersion: 37,
    }));

    render(<FullBackupTransferCard />);
    const input = screen.getByLabelText('Import full backup file');
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Review Restore')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Review Restore'));
    expect((screen.getByRole('button', { name: 'Replace All Data' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('imports a full backup and reloads after confirmation', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    render(<FullBackupTransferCard />);
    const input = screen.getByLabelText('Import full backup file');
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

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
