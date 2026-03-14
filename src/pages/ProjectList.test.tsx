/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectList } from './ProjectList';
import type { Project, Task } from '../lib/types';
import { useTaskStore } from '../lib/stores/task-store';

vi.mock('../lib/stores/task-store', () => ({
  useTaskStore: vi.fn(),
}));

vi.mock('../components/CreateProjectSheet', () => ({
  CreateProjectSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>create-project-sheet</div> : null),
}));

vi.mock('../components/Fab', () => ({
  Fab: ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      fab
    </button>
  ),
}));

const mockedUseTaskStore = vi.mocked(useTaskStore);

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

describe('ProjectList', () => {
  it('filters projects by timeline segment and keeps undated projects in All', () => {
    mockedUseTaskStore.mockReturnValue({
      projects: [
        makeProject({ id: 'current', name: 'Current', assemblyStartDate: '2026-01-01', dismantleEndDate: '2026-01-30' }),
        makeProject({ id: 'next', name: 'Next', assemblyStartDate: '2026-02-15', dismantleEndDate: '2026-02-20' }),
        makeProject({ id: 'past', name: 'Past', assemblyStartDate: '2025-12-01', dismantleEndDate: '2025-12-10' }),
        makeProject({ id: 'undated', name: 'Undated' }),
      ],
      tasks: [
        makeTask({ id: 'task-current', projectId: 'current' }),
      ],
      isLoading: false,
      error: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

    const onSelectProject = vi.fn();
    render(<ProjectList onSelectProject={onSelectProject} />);

    expect(screen.getByText('Current', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.getByText('Next', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.getByText('Past', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.getByText('Undated', { selector: '.project-list__item-name' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Current' }));
    expect(screen.getByText('Current', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.queryByText('Next', { selector: '.project-list__item-name' })).toBeNull();
    expect(screen.queryByText('Undated', { selector: '.project-list__item-name' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Next 90d' }));
    expect(screen.getByText('Next', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.queryByText('Current', { selector: '.project-list__item-name' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));
    expect(screen.getByText('Past', { selector: '.project-list__item-name' })).toBeTruthy();
    expect(screen.queryByText('Undated', { selector: '.project-list__item-name' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Current' }));
    fireEvent.click(screen.getByRole('button', { name: 'Current0 / 1' }));
    expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'current' }));

    vi.useRealTimers();
  });

  it('shows a filter-aware empty state when no projects match', () => {
    mockedUseTaskStore.mockReturnValue({
      projects: [
        makeProject({ id: 'future', name: 'Future', assemblyStartDate: '2026-05-01', dismantleEndDate: '2026-05-10' }),
      ],
      tasks: [],
      isLoading: false,
      error: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

    render(<ProjectList onSelectProject={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));

    expect(screen.getByText('No projects in this window')).toBeTruthy();

    vi.useRealTimers();
  });
});
