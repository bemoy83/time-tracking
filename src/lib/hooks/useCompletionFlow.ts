/**
 * useCompletionFlow hook.
 * Shared completion logic for list views (TodayView, TaskList).
 * Handles parent-with-incomplete-subtasks confirm and all-siblings-done prompt.
 */

import { useState } from 'react';
import { Task } from '../types';
import {
  completeTask,
  completeTaskAndChildren,
} from '../stores/task-store';
import { stopTimer } from '../stores/timer-store';

interface CompletionFlowState {
  /** Task awaiting confirm (parent with incomplete subtasks) */
  confirmTarget: Task | null;
  /** Parent to prompt for completion (all subtasks done) */
  promptParent: Task | null;
}

export function useCompletionFlow(
  tasks: Task[],
  activeTimerTaskId: string | undefined,
) {
  const [state, setState] = useState<CompletionFlowState>({
    confirmTarget: null,
    promptParent: null,
  });

  const handleComplete = async (task: Task) => {
    if (activeTimerTaskId === task.id) {
      await stopTimer();
    }

    const subtasksOfTask = tasks.filter((t) => t.parentId === task.id);
    const incompleteSubtasks = subtasksOfTask.filter((t) => t.status !== 'completed');

    // Parent with incomplete subtasks: show confirm dialog
    if (subtasksOfTask.length > 0 && incompleteSubtasks.length > 0) {
      setState((s) => ({ ...s, confirmTarget: task }));
      return;
    }

    // Complete the task
    await completeTask(task.id);

    // If this is a subtask, check if all siblings are now done
    if (task.parentId) {
      const siblings = tasks.filter((t) => t.parentId === task.parentId);
      const allSiblingsDone = siblings
        .filter((t) => t.id !== task.id)
        .every((t) => t.status === 'completed');
      if (allSiblingsDone) {
        const parent = tasks.find((t) => t.id === task.parentId);
        if (parent && parent.status !== 'completed') {
          setState((s) => ({ ...s, promptParent: parent }));
        }
      }
    }
  };

  const handleConfirmCompleteOnly = async () => {
    if (!state.confirmTarget) return;
    await completeTask(state.confirmTarget.id);
    setState((s) => ({ ...s, confirmTarget: null }));
  };

  const handleConfirmCompleteAll = async () => {
    if (!state.confirmTarget) return;
    await completeTaskAndChildren(state.confirmTarget.id);
    setState((s) => ({ ...s, confirmTarget: null }));
  };

  const handlePromptYes = async () => {
    if (!state.promptParent) return;
    await completeTask(state.promptParent.id);
    setState((s) => ({ ...s, promptParent: null }));
  };

  const dismissConfirm = () => setState((s) => ({ ...s, confirmTarget: null }));
  const dismissPrompt = () => setState((s) => ({ ...s, promptParent: null }));

  return {
    confirmTarget: state.confirmTarget,
    promptParent: state.promptParent,
    handleComplete,
    handleConfirmCompleteOnly,
    handleConfirmCompleteAll,
    handlePromptYes,
    dismissConfirm,
    dismissPrompt,
  };
}
