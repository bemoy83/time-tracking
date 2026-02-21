import { describe, it, expect } from 'vitest';
import type { Task, TaskTemplate } from '../types';
import type { ImportedWorkPackage } from './import';
import { generateImportPreview } from './import-preview';

function makeImportItem(overrides: Partial<ImportedWorkPackage> = {}): ImportedWorkPackage {
  return {
    mappingKey: 'Install carpet::carpet-tiles:m2:build-up',
    title: 'Install carpet',
    workCategory: 'carpet-tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    workQuantity: 100,
    estimatedMinutes: 60,
    defaultWorkers: 2,
    targetProductivity: 10,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'tmpl-1',
    title: 'Install carpet',
    workUnit: 'm2',
    workQuantity: 100,
    estimatedMinutes: 60,
    defaultWorkers: 2,
    targetProductivity: 10,
    buildPhase: 'build-up',
    workCategory: 'carpet-tiles',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Install carpet',
    status: 'active',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: 60,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: 2,
    targetProductivity: 10,
    buildPhase: 'build-up',
    workCategory: 'carpet-tiles',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

describe('generateImportPreview', () => {
  it('marks items as create when no match exists', () => {
    const preview = generateImportPreview([makeImportItem()], [], []);

    expect(preview.summary.create).toBe(1);
    expect(preview.items[0].action).toBe('create');
    expect(preview.items[0].existingId).toBeNull();
  });

  it('marks items as skip when identical template exists', () => {
    const item = makeImportItem();
    const template = makeTemplate();

    const preview = generateImportPreview([item], [], [template]);

    expect(preview.summary.skip).toBe(1);
    expect(preview.items[0].action).toBe('skip');
    expect(preview.items[0].existingId).toBe('tmpl-1');
    expect(preview.items[0].reason).toContain('Identical');
  });

  it('marks items as update when template differs', () => {
    const item = makeImportItem({ workQuantity: 200 }); // differs from template's 100
    const template = makeTemplate({ workQuantity: 100 });

    const preview = generateImportPreview([item], [], [template]);

    expect(preview.summary.update).toBe(1);
    expect(preview.items[0].action).toBe('update');
    expect(preview.items[0].changedFields).toContain('workQuantity');
    expect(preview.items[0].existingId).toBe('tmpl-1');
  });

  it('matches against tasks when no template match', () => {
    const item = makeImportItem();
    const task = makeTask();

    const preview = generateImportPreview([item], [task], []);

    expect(preview.summary.skip).toBe(1);
    expect(preview.items[0].existingId).toBe('task-1');
  });

  it('prefers template match over task match', () => {
    const item = makeImportItem();
    const template = makeTemplate();
    const task = makeTask({ id: 'task-1' });

    const preview = generateImportPreview([item], [task], [template]);

    expect(preview.items[0].existingId).toBe('tmpl-1'); // template wins
  });

  it('detects update for task with different fields', () => {
    const item = makeImportItem({ defaultWorkers: 5 });
    const task = makeTask({ defaultWorkers: 2 });

    const preview = generateImportPreview([item], [task], []);

    expect(preview.items[0].action).toBe('update');
    expect(preview.items[0].changedFields).toContain('defaultWorkers');
  });

  it('detects duplicate mapping keys in import set', () => {
    const item1 = makeImportItem();
    const item2 = makeImportItem(); // same mapping key

    const preview = generateImportPreview([item1, item2], [], []);

    expect(preview.duplicateKeys).toContain('Install carpet::carpet-tiles:m2:build-up');
  });

  it('handles mixed actions', () => {
    const create = makeImportItem({
      mappingKey: 'New task::furniture:pcs:build-up',
      title: 'New task',
      workCategory: 'furniture',
      workUnit: 'pcs',
    });
    const skip = makeImportItem();
    const update = makeImportItem({
      mappingKey: 'Walls::partition-walls:m2:build-up',
      title: 'Walls',
      workCategory: 'partition-walls',
      workQuantity: 300,
    });

    const template = makeTemplate(); // matches skip
    const task = makeTask({
      id: 'task-w',
      title: 'Walls',
      workCategory: 'partition-walls',
      workQuantity: 200, // differs from import's 300
    });

    const preview = generateImportPreview([create, skip, update], [task], [template]);

    expect(preview.summary.create).toBe(1);
    expect(preview.summary.skip).toBe(1);
    expect(preview.summary.update).toBe(1);
  });

  it('skips tasks without work context for matching', () => {
    const item = makeImportItem();
    const task = makeTask({
      workCategory: null,
      workUnit: null,
      buildPhase: null,
    });

    const preview = generateImportPreview([item], [task], []);

    // Task can't generate mapping key → no match → create
    expect(preview.summary.create).toBe(1);
  });

  it('returns empty preview for empty import', () => {
    const preview = generateImportPreview([], [], []);

    expect(preview.items).toHaveLength(0);
    expect(preview.summary).toEqual({ create: 0, update: 0, skip: 0 });
    expect(preview.duplicateKeys).toHaveLength(0);
  });
});
