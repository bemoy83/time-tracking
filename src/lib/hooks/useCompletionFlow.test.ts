/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompletionFlow } from './useCompletionFlow';
import type { Task } from '../types';

vi.mock('../stores/task-store', () => ({
  completeTask: vi.fn().mockResolvedValue(undefined),
  completeTaskAndChildren: vi.fn().mockResolvedValue(undefined),
  reactivateTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/timer-store', () => ({
  stopTimer: vi.fn().mockResolvedValue({ success: true }),
}));

import { completeTask, completeTaskAndChildren, reactivateTask } from '../stores/task-store';
import { stopTimer } from '../stores/timer-store';

const completeTaskMock = vi.mocked(completeTask);
const completeTaskAndChildrenMock = vi.mocked(completeTaskAndChildren);
const reactivateTaskMock = vi.mocked(reactivateTask);
const stopTimerMock = vi.mocked(stopTimer);

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    archiveVersion: null,
    ...overrides,
  };
}

describe('useCompletionFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a standalone task immediately with no dialogs', async () => {
    const task = makeTask({ id: 't1' });
    const { result } = renderHook(() =>
      useCompletionFlow([task], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(task);
    });

    expect(completeTaskMock).toHaveBeenCalledWith('t1');
    expect(result.current.confirmTarget).toBeNull();
    expect(result.current.promptParent).toBeNull();
  });

  it('stops timer before completing when task has an active timer', async () => {
    const task = makeTask({ id: 't1' });
    const { result } = renderHook(() =>
      useCompletionFlow([task], new Set(['t1'])),
    );

    await act(async () => {
      await result.current.handleComplete(task);
    });

    expect(stopTimerMock).toHaveBeenCalledWith('t1');
    expect(completeTaskMock).toHaveBeenCalledWith('t1');
  });

  it('shows confirm dialog when parent has incomplete subtasks, does not complete', async () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(parent);
    });

    expect(result.current.confirmTarget?.id).toBe('parent');
    expect(completeTaskMock).not.toHaveBeenCalled();
  });

  it('confirm complete-all calls completeTaskAndChildren and clears confirmTarget', async () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(parent);
    });
    await act(async () => {
      await result.current.handleConfirmCompleteAll();
    });

    expect(completeTaskAndChildrenMock).toHaveBeenCalledWith('parent');
    expect(result.current.confirmTarget).toBeNull();
  });

  it('dismissConfirm clears confirmTarget without completing', async () => {
    const parent = makeTask({ id: 'parent' });
    const child = makeTask({ id: 'child', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(parent);
    });
    act(() => {
      result.current.dismissConfirm();
    });

    expect(result.current.confirmTarget).toBeNull();
    expect(completeTaskMock).not.toHaveBeenCalled();
  });

  it('shows parent prompt when completing last incomplete subtask', async () => {
    const parent = makeTask({ id: 'parent', status: 'active' });
    const child1 = makeTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const child2 = makeTask({ id: 'c2', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child1, child2], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(child2);
    });

    expect(completeTaskMock).toHaveBeenCalledWith('c2');
    expect(result.current.promptParent?.id).toBe('parent');
  });

  it('prompt yes completes parent and clears prompt', async () => {
    const parent = makeTask({ id: 'parent', status: 'active' });
    const child1 = makeTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const child2 = makeTask({ id: 'c2', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child1, child2], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(child2);
    });
    await act(async () => {
      await result.current.handlePromptYes();
    });

    expect(completeTaskMock).toHaveBeenCalledWith('parent');
    expect(result.current.promptParent).toBeNull();
  });

  it('prompt cancel reactivates the triggering subtask and clears prompt', async () => {
    const parent = makeTask({ id: 'parent', status: 'active' });
    const child1 = makeTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const child2 = makeTask({ id: 'c2', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child1, child2], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(child2);
    });
    await act(async () => {
      await result.current.handlePromptCancel();
    });

    expect(reactivateTaskMock).toHaveBeenCalledWith('c2');
    expect(result.current.promptParent).toBeNull();
  });

  it('dismissPrompt clears prompt without reactivating', async () => {
    const parent = makeTask({ id: 'parent', status: 'active' });
    const child1 = makeTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const child2 = makeTask({ id: 'c2', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child1, child2], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(child2);
    });
    act(() => {
      result.current.dismissPrompt();
    });

    expect(reactivateTaskMock).not.toHaveBeenCalled();
    expect(result.current.promptParent).toBeNull();
  });

  it('does not show parent prompt when parent is already completed', async () => {
    const parent = makeTask({ id: 'parent', status: 'completed' });
    const child1 = makeTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const child2 = makeTask({ id: 'c2', parentId: 'parent', status: 'active' });
    const { result } = renderHook(() =>
      useCompletionFlow([parent, child1, child2], new Set()),
    );

    await act(async () => {
      await result.current.handleComplete(child2);
    });

    expect(result.current.promptParent).toBeNull();
  });
});
