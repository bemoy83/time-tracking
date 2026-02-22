import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildPhase, Task, TaskTemplate, WorkType } from '../types';
import { normalizeWorkTypeTitle } from '../types';

const mockState = vi.hoisted(() => ({
  tasks: [] as Task[],
  templates: [] as TaskTemplate[],
  workTypes: [] as WorkType[],
}));

const mockUpdateTaskFields = vi.hoisted(() => vi.fn());
const mockUpdateTemplate = vi.hoisted(() => vi.fn());

vi.mock('../stores/task-store', () => ({
  getState: () => ({
    tasks: mockState.tasks,
    projects: [],
    isLoading: false,
    error: null,
  }),
  updateTaskFields: mockUpdateTaskFields,
}));

vi.mock('../stores/template-store', () => ({
  getSnapshot: () => ({
    templates: mockState.templates,
    isLoading: false,
  }),
  updateTemplate: mockUpdateTemplate,
}));

vi.mock('../stores/work-type-store', () => ({
  getSnapshot: () => ({
    workTypes: mockState.workTypes,
    isLoading: false,
  }),
  findWorkTypeByKey: (title: string, workUnit: string, buildPhase: BuildPhase) =>
    mockState.workTypes.find(
      (wt) =>
        normalizeWorkTypeTitle(wt.title) === normalizeWorkTypeTitle(title) &&
        wt.workUnit === workUnit &&
        wt.buildPhase === buildPhase,
    ),
}));

function makeWorkType(overrides: Partial<WorkType> = {}): WorkType {
  return {
    id: 'wt-1',
    title: 'Carpet Tiles',
    workUnit: 'm2',
    buildPhase: 'build-up',
    expectedProductivity: 55,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Carpet Tiles',
    status: 'active',
    projectId: null,
    parentId: null,
    blockedReason: null,
    estimatedMinutes: null,
    workQuantity: 100,
    workUnit: 'm2',
    defaultWorkers: null,
    targetProductivity: null,
    buildPhase: 'build-up',
    workTypeId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'tpl-1',
    title: 'Carpet Tiles',
    workTypeId: null,
    workUnit: 'm2',
    workQuantity: 100,
    estimatedMinutes: 60,
    defaultWorkers: 2,
    targetProductivity: null,
    buildPhase: 'build-up',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('runWorkTypeLinkBackfill', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUpdateTaskFields.mockReset();
    mockUpdateTemplate.mockReset();
    mockState.tasks = [];
    mockState.templates = [];
    mockState.workTypes = [];
  });

  it('fills missing workTypeId using exact title + unit + phase match', async () => {
    mockState.workTypes = [makeWorkType()];
    mockState.tasks = [makeTask()];
    mockState.templates = [makeTemplate()];

    const { runWorkTypeLinkBackfill } = await import('./backfill-worktype-link');
    const report = await runWorkTypeLinkBackfill();

    expect(report.ran).toBe(true);
    expect(report.updated).toBe(2);
    expect(report.taskUpdates).toBe(1);
    expect(report.templateUpdates).toBe(1);
    expect(mockUpdateTaskFields).toHaveBeenCalledWith('task-1', expect.objectContaining({ workTypeId: 'wt-1' }));
    expect(mockUpdateTemplate).toHaveBeenCalledWith('tpl-1', expect.objectContaining({ workTypeId: 'wt-1' }));
  });

  it('marks unresolved link as ambiguous when title+unit maps to multiple phases', async () => {
    mockState.workTypes = [
      makeWorkType({ id: 'wt-up', buildPhase: 'build-up' }),
      makeWorkType({ id: 'wt-down', buildPhase: 'tear-down' }),
    ];
    mockState.tasks = [makeTask({ buildPhase: null })];

    const { runWorkTypeLinkBackfill } = await import('./backfill-worktype-link');
    const report = await runWorkTypeLinkBackfill();

    expect(report.updated).toBe(0);
    expect(report.ambiguous).toBe(1);
    expect(mockUpdateTaskFields).not.toHaveBeenCalled();
  });

  it('skips unresolved rows when title + unit + phase does not deterministically match', async () => {
    mockState.workTypes = [makeWorkType()];
    mockState.tasks = [
      makeTask({
        title: 'Custom Task Title',
      }),
    ];

    const { runWorkTypeLinkBackfill } = await import('./backfill-worktype-link');
    const report = await runWorkTypeLinkBackfill();

    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(1);
    expect(report.ambiguous).toBe(0);
    expect(mockUpdateTaskFields).not.toHaveBeenCalled();
  });

  it('runs once per app session (idempotent guard)', async () => {
    mockState.workTypes = [makeWorkType()];
    mockState.tasks = [makeTask()];

    const { runWorkTypeLinkBackfill } = await import('./backfill-worktype-link');
    const first = await runWorkTypeLinkBackfill();
    const second = await runWorkTypeLinkBackfill();

    expect(first.ran).toBe(true);
    expect(second.ran).toBe(false);
    expect(mockUpdateTaskFields).toHaveBeenCalledTimes(1);
  });
});
