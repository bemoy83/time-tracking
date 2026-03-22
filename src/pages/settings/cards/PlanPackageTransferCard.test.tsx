/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPackageTransferCard } from './PlanPackageTransferCard';
import { useWorkUnitStore } from '../../../lib/stores/work-unit-store';
import { useWorkUnitImportPreview } from '../../../lib/hooks/useWorkUnitImportPreview';
import {
  applyPlanPackageImport,
  parsePlanPackageJson,
  previewPlanPackageImport,
} from '../../../lib/interop/data-transfer/plan-package';

vi.mock('../../../lib/stores/work-unit-store', () => ({
  useWorkUnitStore: vi.fn(),
}));

vi.mock('../../../lib/hooks/useWorkUnitImportPreview', () => ({
  useWorkUnitImportPreview: vi.fn(),
}));

vi.mock('../../../lib/interop/data-transfer/plan-package', () => ({
  applyPlanPackageImport: vi.fn(),
  parsePlanPackageJson: vi.fn(),
  previewPlanPackageImport: vi.fn(),
}));

vi.mock('../../../lib/telemetry/telemetry', () => ({
  trackTelemetryEvent: vi.fn(),
}));

const mockedUseWorkUnitStore = vi.mocked(useWorkUnitStore);
const mockedUseWorkUnitImportPreview = vi.mocked(useWorkUnitImportPreview);
const mockedParsePlanPackageJson = vi.mocked(parsePlanPackageJson);
const mockedPreviewPlanPackageImport = vi.mocked(previewPlanPackageImport);
const mockedApplyPlanPackageImport = vi.mocked(applyPlanPackageImport);

describe('PlanPackageTransferCard', () => {
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
    mockedParsePlanPackageJson.mockReturnValue({
      ok: true,
      envelope: {
        schemaVersion: '4.0',
        exportType: 'plan-package',
        exportedAt: '2026-03-22T10:00:00.000Z',
        appVersion: '0.0.1',
        payload: {
          workUnitDefinitions: [],
        } as never,
      },
    });
    mockedPreviewPlanPackageImport.mockResolvedValue({
      planId: 'plan-1',
      title: 'Expo Plan',
      lineItemCount: 1,
      workTypeCount: 1,
      workUnitCount: 0,
      projectCount: 0,
      tagCount: 0,
      lastModifiedAt: '2026-03-22T10:00:00.000Z',
      conflict: 'none',
      existingStatus: null,
      envelope: {
        schemaVersion: '4.0',
        exportType: 'plan-package',
        exportedAt: '2026-03-22T10:00:00.000Z',
        appVersion: '0.0.1',
        payload: {
          workUnitDefinitions: [],
        } as never,
      },
    });
    mockedApplyPlanPackageImport.mockResolvedValue({
      applied: true,
      merged: false,
      reason: 'Imported plan package.',
    });
  });

  it('uses a labeled hidden file input for plan package import', async () => {
    render(<PlanPackageTransferCard />);
    const input = screen.getByLabelText('Import plan package file');
    const file = new File(['{}'], 'plan.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedPreviewPlanPackageImport).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Expo Plan')).toBeTruthy();
    });
  });

  it('applies a plan package import from the card', async () => {
    render(<PlanPackageTransferCard />);
    const input = screen.getByLabelText('Import plan package file');
    const file = new File(['{}'], 'plan.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply Import' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply Import' }));

    await waitFor(() => {
      expect(mockedApplyPlanPackageImport).toHaveBeenCalledTimes(1);
    });
  });
});
