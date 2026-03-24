import { describe, expect, it } from 'vitest';
import type { Project, Task } from '../../lib/types';
import { buildTodayViewModel, showPromotionalEmptyState } from './today-view-model';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Spring Expo',
    color: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    eventStartDate: null,
    eventEndDate: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'active',
    projectId: null,
    parentId: null,
    blockReason: null,
    estimatedMinutes: null,
    workQuantity: null,
    workUnit: null,
    crew: null,
    targetProductivity: null,
    phase: null,
    workTypeId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    excludeFromKpi: false,
    ...overrides,
  };
}

describe('buildTodayViewModel', () => {
  it('groups active tasks by project order and keeps ungrouped tasks separate', () => {
    const projects = [
      makeProject({ id: 'project-b', name: 'Project B' }),
      makeProject({ id: 'project-a', name: 'Project A' }),
    ];
    const tasks = [
      makeTask({ id: 'ungrouped-1', title: 'Ungrouped', projectId: null }),
      makeTask({ id: 'project-a-1', title: 'Project A task', projectId: 'project-a' }),
      makeTask({ id: 'blocked-1', status: 'blocked', projectId: 'project-b' }),
      makeTask({ id: 'project-b-1', title: 'Project B task', projectId: 'project-b' }),
      makeTask({ id: 'completed-1', status: 'completed', projectId: null }),
    ];

    const model = buildTodayViewModel(tasks, projects);

    expect(model.ungroupedTasks.map((task) => task.id)).toEqual(['ungrouped-1']);
    expect(model.groupedTasks).toHaveLength(2);
    expect(model.groupedTasks.map((group) => group.project.id)).toEqual(['project-b', 'project-a']);
    expect(model.groupedTasks[0].tasks.map((task) => task.id)).toEqual(['project-b-1']);
    expect(model.groupedTasks[1].tasks.map((task) => task.id)).toEqual(['project-a-1']);
    expect(model.blockedTasks.map((task) => task.id)).toEqual(['blocked-1']);
    expect(model.completedTasks.map((task) => task.id)).toEqual(['completed-1']);
  });
});

describe('showPromotionalEmptyState', () => {
  it('returns false when top-level completed tasks exist', () => {
    const model = buildTodayViewModel(
      [makeTask({ id: 'completed-1', status: 'completed' })],
      []
    );

    expect(showPromotionalEmptyState(model)).toBe(false);
  });

  it('returns true when all top-level buckets are empty', () => {
    const model = buildTodayViewModel([], []);

    expect(showPromotionalEmptyState(model)).toBe(true);
  });

  it('ignores subtasks when deciding whether to show the empty state', () => {
    const model = buildTodayViewModel(
      [
        makeTask({
          id: 'subtask-completed',
          status: 'completed',
          parentId: 'parent-1',
        }),
        makeTask({
          id: 'subtask-active',
          status: 'active',
          parentId: 'parent-2',
        }),
      ],
      []
    );

    expect(showPromotionalEmptyState(model)).toBe(true);
  });
});
