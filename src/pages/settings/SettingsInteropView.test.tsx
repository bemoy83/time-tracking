import { describe, expect, it, vi } from 'vitest';
import type { ImportedWorkPackage } from '../../lib/interop/import';
import { applyWorkPackageImportItems } from '../../lib/interop/work-package-import-apply';

describe('applyWorkPackageImportItems', () => {
  it('auto-creates missing work type and applies created template with new workTypeId', async () => {
    const payload: ImportedWorkPackage = {
      mappingKey: 'Install carpet::Carpet Tiles:m2:build-up',
      title: 'Install carpet',
      workTypeTitle: 'Carpet Tiles',
      workUnit: 'm2',
      buildPhase: 'build-up',
      workTypeId: null,
      workQuantity: 100,
      estimatedMinutes: 60,
      defaultWorkers: 2,
      targetProductivity: 10,
    };

    const ensureWorkTypeExistsOrCreateFn = vi.fn().mockResolvedValue('wt-new');
    const createTemplateFn = vi.fn().mockResolvedValue(undefined);

    const result = await applyWorkPackageImportItems(
      [{ action: 'create', item: payload, reason: null, existingId: null, existingType: null, changedFields: [] }],
      {
        ensureWorkTypeExistsOrCreateFn,
        createTemplateFn,
        updateTaskFieldsFn: vi.fn(),
        updateTemplateFn: vi.fn(),
      },
    );

    expect(ensureWorkTypeExistsOrCreateFn).toHaveBeenCalledWith('Carpet Tiles', 'm2', 'build-up', 0);
    expect(createTemplateFn).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Install carpet',
      workTypeId: 'wt-new',
      workUnit: 'm2',
      buildPhase: 'build-up',
    }));
    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 });
  });
});
