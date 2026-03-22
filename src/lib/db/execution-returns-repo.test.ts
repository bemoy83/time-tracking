import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportedExecutionReturnRecord } from '../interop/data-transfer/contracts';
import { getDB } from './core';
import {
  getExecutionReturnsByPlanId,
  getLatestExecutionReturnSummariesByPlanIds,
  getLatestExecutionReturnSummaryByPlanId,
} from './execution-returns-repo';

vi.mock('./core', () => ({
  getDB: vi.fn(),
}));

const mockedGetDB = vi.mocked(getDB);

function makeRecord(
  overrides: Partial<ImportedExecutionReturnRecord> = {},
): ImportedExecutionReturnRecord {
  return {
    id: 'return-1',
    planId: 'plan-1',
    planTitle: 'Plan 1',
    closedAt: '2026-03-20T17:00:00.000Z',
    importedAt: '2026-03-20T18:00:00.000Z',
    schemaVersion: '4.0',
    appVersion: '0.0.1',
    exportType: 'execution-return',
    exportedAt: '2026-03-20T17:30:00.000Z',
    mergeSummary: {
      importedAt: '2026-03-20T18:00:00.000Z',
      importedEntryCount: 3,
      skippedDuplicateEntryCount: 1,
      mergedTaskCount: 4,
      lineItemCount: 2,
    },
    ...overrides,
  };
}

describe('execution-returns-repo', () => {
  beforeEach(() => {
    mockedGetDB.mockReset();
  });

  it('normalizes missing merge summaries when loading by plan id', async () => {
    mockedGetDB.mockResolvedValue({
      getAllFromIndex: vi.fn().mockResolvedValue([
        {
          ...makeRecord(),
          mergeSummary: undefined,
        },
      ]),
    } as unknown as Awaited<ReturnType<typeof getDB>>);

    const records = await getExecutionReturnsByPlanId('plan-1');

    expect(records[0].mergeSummary).toEqual({
      importedAt: '2026-03-20T18:00:00.000Z',
      importedEntryCount: 0,
      skippedDuplicateEntryCount: 0,
      mergedTaskCount: 0,
      lineItemCount: 0,
    });
  });

  it('returns the latest execution return summary for a plan', async () => {
    mockedGetDB.mockResolvedValue({
      getAllFromIndex: vi.fn().mockResolvedValue([
        makeRecord({ id: 'older', importedAt: '2026-03-20T18:00:00.000Z' }),
        makeRecord({
          id: 'newer',
          importedAt: '2026-03-21T08:15:00.000Z',
          mergeSummary: {
            importedAt: '2026-03-21T08:15:00.000Z',
            importedEntryCount: 5,
            skippedDuplicateEntryCount: 0,
            mergedTaskCount: 6,
            lineItemCount: 3,
          },
        }),
      ]),
    } as unknown as Awaited<ReturnType<typeof getDB>>);

    const summary = await getLatestExecutionReturnSummaryByPlanId('plan-1');

    expect(summary).toEqual({
      executionReturnId: 'newer',
      planId: 'plan-1',
      planTitle: 'Plan 1',
      importedAt: '2026-03-21T08:15:00.000Z',
      mergeSummary: {
        importedAt: '2026-03-21T08:15:00.000Z',
        importedEntryCount: 5,
        skippedDuplicateEntryCount: 0,
        mergedTaskCount: 6,
        lineItemCount: 3,
      },
    });
  });

  it('returns latest summaries for multiple plan ids', async () => {
    mockedGetDB.mockResolvedValue({
      getAll: vi.fn().mockResolvedValue([
        makeRecord({ id: 'plan-1-old', planId: 'plan-1', importedAt: '2026-03-20T18:00:00.000Z' }),
        makeRecord({ id: 'plan-2-latest', planId: 'plan-2', planTitle: 'Plan 2', importedAt: '2026-03-21T09:00:00.000Z' }),
        makeRecord({ id: 'plan-1-latest', planId: 'plan-1', importedAt: '2026-03-21T10:00:00.000Z' }),
      ]),
    } as unknown as Awaited<ReturnType<typeof getDB>>);

    const summaries = await getLatestExecutionReturnSummariesByPlanIds(['plan-1', 'plan-2']);

    expect(summaries.get('plan-1')).toEqual(
      expect.objectContaining({
        executionReturnId: 'plan-1-latest',
        importedAt: '2026-03-21T10:00:00.000Z',
      }),
    );
    expect(summaries.get('plan-2')).toEqual(
      expect.objectContaining({
        executionReturnId: 'plan-2-latest',
        importedAt: '2026-03-21T09:00:00.000Z',
      }),
    );
  });
});
