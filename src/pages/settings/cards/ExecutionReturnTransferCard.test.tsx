/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionReturnTransferCard } from './ExecutionReturnTransferCard';
import { useWorkUnitStore } from '../../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../../lib/hooks/useWorkUnitImportPreview';
import {
  applyExecutionReturnImport,
  parseExecutionReturnJson,
  previewExecutionReturnImport,
} from '../../../lib/interop/data-transfer/execution-return-import';

vi.mock('../../../lib/stores/work-unit-store', () => ({
  useWorkUnitStore: vi.fn(),
}));

vi.mock('../../../lib/hooks/useWorkUnitImportPreview', () => ({
  useWorkUnitImportPreview: vi.fn(),
}));

vi.mock('../../../lib/interop/data-transfer/execution-return-import', () => ({
  applyExecutionReturnImport: vi.fn(),
  formatExecutionReturnMergeSummary: vi.fn(() => 'merge summary'),
  parseExecutionReturnJson: vi.fn(),
  previewExecutionReturnImport: vi.fn(),
}));

vi.mock('../../../lib/telemetry/telemetry', () => ({
  trackTelemetryEvent: vi.fn(),
}));

const mockedUseWorkUnitStore = vi.mocked(useWorkUnitStore);
const mockedUseWorkUnitImportPreview = vi.mocked(useWorkUnitImportPreview);
const mockedParseExecutionReturnJson = vi.mocked(parseExecutionReturnJson);
const mockedPreviewExecutionReturnImport = vi.mocked(previewExecutionReturnImport);
const mockedApplyExecutionReturnImport = vi.mocked(applyExecutionReturnImport);

describe('ExecutionReturnTransferCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    mockedParseExecutionReturnJson.mockReturnValue({
      ok: true,
      envelope: {
        schemaVersion: '4.0',
        exportType: 'execution-return',
        exportedAt: '2026-03-22T10:00:00.000Z',
        appVersion: '0.0.1',
        payload: {
          workUnitDefinitions: [],
        } as never,
      },
    });
    mockedPreviewExecutionReturnImport.mockResolvedValue({
      planId: 'plan-1',
      planTitle: 'Expo Plan',
      closedAt: '2026-03-22T10:00:00.000Z',
      timeEntryCount: 1,
      duplicateTimeEntryIds: [],
      conflicts: [],
      unplannedTaskCount: 0,
      lineItemCount: 1,
      workUnitCount: 0,
      dateRangeStart: '2026-03-22T08:00:00.000Z',
      dateRangeEnd: '2026-03-22T09:00:00.000Z',
      envelope: {
        schemaVersion: '4.0',
        exportType: 'execution-return',
        exportedAt: '2026-03-22T10:00:00.000Z',
        appVersion: '0.0.1',
        payload: {
          workUnitDefinitions: [],
        } as never,
      },
    });
    mockedApplyExecutionReturnImport.mockResolvedValue({
      importedEntryCount: 1,
      skippedDuplicateEntryCount: 0,
      executionReturnId: 'return-1',
      lineItemCount: 1,
      unplannedTaskCount: 0,
      mergeSummary: {
        importedAt: '2026-03-22T10:00:00.000Z',
        importedEntryCount: 1,
        skippedDuplicateEntryCount: 0,
        mergedTaskCount: 1,
        lineItemCount: 1,
      },
      reason: 'Imported execution return. 1 new entry, 0 duplicate entries skipped, 1 task merged, 1 line item reflected.',
    });
  });

  it('uses a labeled hidden file input for execution return import', async () => {
    render(<ExecutionReturnTransferCard />);
    const input = screen.getByLabelText('Import execution return file');
    const file = new File(['{}'], 'return.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedPreviewExecutionReturnImport).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Expo Plan')).toBeTruthy();
    });
  });

  it('applies an execution return import from the card', async () => {
    render(<ExecutionReturnTransferCard />);
    const input = screen.getByLabelText('Import execution return file');
    const file = new File(['{}'], 'return.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply Import' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply Import' }));

    await waitFor(() => {
      expect(mockedApplyExecutionReturnImport).toHaveBeenCalledTimes(1);
    });
  });
});
