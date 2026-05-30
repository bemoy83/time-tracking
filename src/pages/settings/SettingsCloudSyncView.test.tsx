/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsCloudSyncView } from './SettingsCloudSyncView';
import type { CatalogPullPreview, CloudCatalogStatus } from '../../lib/cloud/catalog-sync';
import type { CatalogSnapshotPayload } from '../../lib/cloud/catalog-sync';

const serviceMocks = vi.hoisted(() => ({
  applyCloudCatalogPull: vi.fn(),
  buildLocalCatalogSnapshot: vi.fn(),
  getCloudCatalogStatus: vi.fn(),
  getSession: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  previewCloudCatalogPull: vi.fn(),
  pushLocalCatalogSnapshot: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../lib/cloud/catalog-sync', () => serviceMocks);

function makeSession() {
  return {
    user: {
      id: 'user-1',
      email: 'planner@example.com',
    },
  };
}

function makeSnapshot(): CatalogSnapshotPayload {
  return {
    snapshotFormatVersion: 1 as const,
    exportedAt: '2026-01-01T00:00:00.000Z',
    workUnitDefinitions: [{
      id: 'm2',
      label: 'm²',
      sortIndex: 0,
      builtIn: true,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    workTypes: [{
      id: 'wt-1',
      title: 'Carpet',
      workUnit: 'm2',
      assemblyRate: 1,
      dismantleRate: 1,
      tagIds: [],
      skillTagId: null,
      readOnly: false,
      importedForPlanId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    tagCategories: [{
      id: 'cat-1',
      name: 'Area',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    tags: [{
      id: 'tag-1',
      categoryId: 'cat-1',
      name: 'Hall A',
      color: '#2563eb',
      sequencable: true,
      skillTag: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    globalTagSequence: { id: 'global', tagIds: ['tag-1'], updatedAt: '2026-01-01T00:00:00.000Z' },
    crewPool: { id: 'global', allocations: {}, updatedAt: '2026-01-01T00:00:00.000Z' },
  };
}

function makeStatus(hasSnapshot: boolean): CloudCatalogStatus {
  return {
    workspace: { id: 'workspace-1', name: 'My Workspace' },
    hasSnapshot,
    schemaVersion: hasSnapshot ? 'catalog-1.0' : null,
    catalogVersion: hasSnapshot ? '2026-01-01T00:00:00.000Z' : null,
    updatedAt: hasSnapshot ? '2026-01-01T00:00:00.000Z' : null,
    updatedBy: hasSnapshot ? 'user-1' : null,
    payload: hasSnapshot ? makeSnapshot() : null,
  };
}

beforeEach(() => {
  Object.values(serviceMocks).forEach((mock) => mock.mockReset());
  serviceMocks.isSupabaseConfigured.mockReturnValue(true);
  serviceMocks.buildLocalCatalogSnapshot.mockResolvedValue(makeSnapshot());
});

describe('SettingsCloudSyncView', () => {
  it('shows a disabled state when Supabase env vars are missing', () => {
    serviceMocks.isSupabaseConfigured.mockReturnValue(false);

    render(<SettingsCloudSyncView onBack={vi.fn()} />);

    expect(screen.getByText(/Supabase is not configured/i)).toBeTruthy();
  });

  it('shows signed-out state', async () => {
    serviceMocks.getSession.mockResolvedValue(null);

    render(<SettingsCloudSyncView onBack={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Send sign-in link/i })).toBeTruthy();
  });

  it('shows upload controls for a signed-in empty workspace', async () => {
    serviceMocks.getSession.mockResolvedValue(makeSession());
    serviceMocks.getCloudCatalogStatus.mockResolvedValue(makeStatus(false));

    render(<SettingsCloudSyncView onBack={vi.fn()} />);

    expect(await screen.findByText(/Signed in as planner@example.com/i)).toBeTruthy();
    expect(screen.getByText(/Cloud snapshot: None/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Upload local setup/i })).toBeTruthy();
  });

  it('previews a blocked pull', async () => {
    serviceMocks.getSession.mockResolvedValue(makeSession());
    serviceMocks.getCloudCatalogStatus.mockResolvedValue(makeStatus(true));
    serviceMocks.previewCloudCatalogPull.mockResolvedValue({
      payload: makeSnapshot(),
      counts: {
        workUnitDefinitions: 1,
        workTypes: 1,
        tagCategories: 1,
        tags: 1,
        globalTagSequence: 1,
        crewPool: 1,
      },
      blocked: true,
      issues: [
        {
          entity: 'workType',
          id: 'wt-1',
          label: 'Carpet',
          references: { tasks: 1, plans: 2, templates: 0, readOnlyWorkTypes: 0 },
        },
      ],
    } satisfies CatalogPullPreview);

    render(<SettingsCloudSyncView onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pull cloud setup/i }));

    expect(await screen.findByText(/Pull blocked by local references/i)).toBeTruthy();
    expect(screen.getByText(/Carpet: 1 task refs/i)).toBeTruthy();
  });

  it('applies a successful pull', async () => {
    serviceMocks.getSession.mockResolvedValue(makeSession());
    serviceMocks.getCloudCatalogStatus.mockResolvedValue(makeStatus(true));
    serviceMocks.previewCloudCatalogPull.mockResolvedValue({
      payload: makeSnapshot(),
      counts: {
        workUnitDefinitions: 1,
        workTypes: 1,
        tagCategories: 1,
        tags: 1,
        globalTagSequence: 1,
        crewPool: 1,
      },
      blocked: false,
      issues: [],
    } satisfies CatalogPullPreview);

    render(<SettingsCloudSyncView onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Pull cloud setup/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Apply pull/i }));

    await waitFor(() => expect(serviceMocks.applyCloudCatalogPull).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Cloud setup pulled into this device/i)).toBeTruthy();
  });
});
