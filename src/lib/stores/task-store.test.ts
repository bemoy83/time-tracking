import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Task } from '../types';
import type { Plan } from '../planning/plan-model';

const dbMocks = vi.hoisted(() => ({
  getAllTasks: vi.fn(),
  getAllProjects: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  addProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getTimeEntriesByTask: vi.fn(),
  deleteTimeEntriesByTask: vi.fn(),
  deleteTask: vi.fn(),
  getAllActiveTimers: vi.fn(),
  getTask: vi.fn(),
  getAllPlans: vi.fn(),
  updatePlan: vi.fn(),
}));

vi.mock('../db', () => ({
  getAllTasks: dbMocks.getAllTasks,
  getAllProjects: dbMocks.getAllProjects,
  addTask: dbMocks.addTask,
  updateTask: dbMocks.updateTask,
  addProject: dbMocks.addProject,
  updateProject: dbMocks.updateProject,
  deleteProject: dbMocks.deleteProject,
  getTimeEntriesByTask: dbMocks.getTimeEntriesByTask,
  deleteTimeEntriesByTask: dbMocks.deleteTimeEntriesByTask,
  deleteTask: dbMocks.deleteTask,
  getAllActiveTimers: dbMocks.getAllActiveTimers,
  getTask: dbMocks.getTask,
  getAllPlans: dbMocks.getAllPlans,
  updatePlan: dbMocks.updatePlan,
}));

vi.mock('./timer-store', () => ({
  stopTimer: vi.fn(),
}));

vi.mock('../archive/archive-action', () => ({
  archiveTask: vi.fn(),
}));

vi.mock('../planning/task-plan-block-sync', () => ({
  syncTaskBlockToPlan: vi.fn(),
  syncTaskUnblockToPlan: vi.fn(),
}));

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
    projectId: 'project-1',
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

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'Plan',
    status: 'draft',
    lineItems: [],
    projectId: 'project-1',
    eventStartDate: null,
    eventEndDate: null,
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    defaultCrewSize: null,
    workCalendar: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    sessionClosedAt: null,
    ...overrides,
  };
}

async function loadStore() {
  return import('./task-store');
}

beforeEach(() => {
  vi.resetModules();
  Object.values(dbMocks).forEach((mock) => mock.mockReset());
  dbMocks.getAllActiveTimers.mockResolvedValue([]);
});

describe('hasProjectPhaseDates', () => {
  it('returns true when assembly or dismantle dates are complete', async () => {
    const store = await loadStore();
    expect(store.hasProjectPhaseDates(makeProject({
      assemblyStartDate: '2026-05-01',
      assemblyEndDate: '2026-05-03',
    }))).toBe(true);
    expect(store.hasProjectPhaseDates(makeProject())).toBe(false);
  });
});

describe('ensureProjectColorAssigned', () => {
  it('assigns the next unused palette color to unassigned projects', async () => {
    const store = await loadStore();
    store.setState({
      tasks: [],
      projects: [
        makeProject({ id: 'project-a', color: '' }),
        makeProject({ id: 'project-b', color: '#2563eb' }),
      ],
      isLoading: false,
      error: null,
    });
    dbMocks.getAllProjects.mockResolvedValue([
      makeProject({ id: 'project-a', color: '#dc2626' }),
      makeProject({ id: 'project-b', color: '#2563eb' }),
    ]);

    await store.ensureProjectColorAssigned('project-a');

    expect(dbMocks.updateProject).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-a',
      color: '#dc2626',
    }));
    expect(store.getProjectById('project-a')?.color).toBe('#dc2626');
  });
});

describe('deleteProjectWithMode', () => {
  it('clears linked plan projectIds before deleting the project', async () => {
    const store = await loadStore();
    store.setState({
      tasks: [makeTask()],
      projects: [makeProject()],
      isLoading: false,
      error: null,
    });
    dbMocks.getAllPlans.mockResolvedValue([
      makePlan({ id: 'plan-linked', projectId: 'project-1' }),
      makePlan({ id: 'plan-other', projectId: 'project-2' }),
    ]);

    await store.deleteProjectWithMode('project-1', 'unassign');

    expect(dbMocks.updatePlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'plan-linked',
      projectId: null,
    }));
    expect(dbMocks.deleteProject).toHaveBeenCalledWith('project-1');
    expect(store.getSnapshot().tasks[0].projectId).toBe(null);
  });
});
