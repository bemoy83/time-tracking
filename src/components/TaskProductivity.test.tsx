/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TaskProductivity } from './TaskProductivity';

const { refreshSpy } = vi.hoisted(() => ({
  refreshSpy: vi.fn(),
}));

vi.mock('../lib/hooks/useAttributedPersonHours', () => ({
  useAttributedPersonHours: () => ({
    attributedPersonMs: 3_600_000,
    isLoading: false,
    refresh: refreshSpy,
  }),
}));

vi.mock('../lib/stores/timer-store', () => ({
  useTimerStore: () => ({
    activeTimers: [],
  }),
}));

vi.mock('../lib/stores/task-store', () => ({
  useTask: () => ({
    id: 'task-1',
    title: 'Install carpet',
    status: 'active',
    projectId: null,
    parentId: null,
    blockReason: null,
    estimatedMinutes: 60,
    workQuantity: 100,
    workUnit: 'm2',
    crew: 2,
    targetProductivity: 40,
    phase: 'assembly',
    workTypeId: 'wt-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    excludeFromKpi: false,
  }),
  useTaskStore: () => ({
    tasks: [],
  }),
}));

vi.mock('../lib/stores/subtask-time-rollup-settings', () => ({
  useSubtaskTimeRollupMode: () => 'attribution',
}));

vi.mock('../lib/stores/work-type-store', () => ({
  getWorkTypeById: () => ({
    id: 'wt-1',
    title: 'Carpet Tiles',
  }),
}));

vi.mock('./ExpandableSection', () => ({
  ExpandableSection: ({
    children,
    label,
  }: {
    children: ReactNode;
    label: string;
  }) => <section aria-label={label}>{children}</section>,
}));

vi.mock('./icons', () => ({
  SpeedIcon: () => <span aria-hidden="true">speed</span>,
}));

describe('TaskProductivity', () => {
  it('does not invoke onAttributedRefresh during server render', () => {
    const onAttributedRefresh = vi.fn();

    renderToStaticMarkup(
      <TaskProductivity
        taskId="task-1"
        subtaskIds={['subtask-1']}
        onAttributedRefresh={onAttributedRefresh}
      />,
    );

    expect(onAttributedRefresh).not.toHaveBeenCalled();
  });

  it('registers refresh after mount', () => {
    const onAttributedRefresh = vi.fn();

    render(
      <TaskProductivity
        taskId="task-1"
        subtaskIds={['subtask-1']}
        onAttributedRefresh={onAttributedRefresh}
      />,
    );

    expect(onAttributedRefresh).toHaveBeenCalledWith(refreshSpy);
  });
});
