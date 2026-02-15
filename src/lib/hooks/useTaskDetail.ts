/**
 * useTaskDetail hook.
 * Extracts all state and handlers from TaskDetail page into a reusable hook.
 */

import { useState } from 'react';
import { Task, Project } from '../types';
import {
  useTask,
  useSubtasks,
  useTaskStore,
  completeTask,
  completeTaskAndChildren,
  reactivateTask,
  blockTask,
  unblockTask,
  assignToProject,
  getDeletePreview,
  deleteTaskWithEntries,
  DeletePreview,
} from '../stores/task-store';
import {
  useTimerStore,
  startTimer,
  stopTimer,
  setTimerWorkers,
} from '../stores/timer-store';
import { useTaskTimes } from './useTaskTimes';

interface CompletionFlow {
  showConfirm: boolean;
  showPrompt: boolean;
  incompleteCount: number;
  promptParentTitle: string;
  handleComplete: () => Promise<void>;
  handleConfirmCompleteOnly: () => Promise<void>;
  handleConfirmCompleteAll: () => Promise<void>;
  handlePromptYes: () => Promise<void>;
  handlePromptNo: () => void;
  handlePromptCancel: () => Promise<void>;
  dismissConfirm: () => void;
}

interface DeleteFlow {
  showConfirm: boolean;
  preview: DeletePreview | null;
  isDeleting: boolean;
  handleDeleteClick: () => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  dismissConfirm: () => void;
}

interface BlockFlow {
  showInput: boolean;
  reason: string;
  setReason: (v: string) => void;
  showBlockInput: () => void;
  hideBlockInput: () => void;
  handleBlock: () => Promise<void>;
  handleUnblock: () => Promise<void>;
}

export interface UseTaskDetailReturn {
  task: Task | undefined;
  subtasks: Task[];
  parentTask: Task | null;
  project: Project | null;
  isTimerActive: boolean;
  isBlocked: boolean;
  isCompleted: boolean;
  isSubtask: boolean;
  error: string | null;
  taskTimes: Map<string, number>;
  activeTimers: ReturnType<typeof useTimerStore>['activeTimers'];

  // Actions
  handleStartTimer: (t: Task) => Promise<void>;
  handleStopTimer: () => Promise<void>;
  handleReactivate: () => Promise<void>;
  handleSetWorkers: (n: number) => void;
  handleCompleteSubtask: (subtask: Task) => Promise<void>;

  // Flows
  completionFlow: CompletionFlow;
  deleteFlow: DeleteFlow;
  blockFlow: BlockFlow;

  // Project picker
  showProjectPicker: boolean;
  setShowProjectPicker: (v: boolean) => void;
  handleAssignProject: (projectId: string | null) => Promise<void>;
}

export function useTaskDetail(taskId: string, onBack: () => void): UseTaskDetailReturn {
  const task = useTask(taskId);
  const subtasks = useSubtasks(taskId);
  const { tasks, projects } = useTaskStore();
  const { activeTimers } = useTimerStore();
  const taskTimes = useTaskTimes(tasks, activeTimers);

  // Block flow state
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Project picker
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Delete flow state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Completion flow state
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);
  const [completePromptParentId, setCompletePromptParentId] = useState<string | null>(null);
  const [lastCompletedSubtaskId, setLastCompletedSubtaskId] = useState<string | null>(null);

  // Derived state
  const isTimerActive = activeTimers.some((t) => t.taskId === task?.id);
  const isBlocked = task?.status === 'blocked';
  const isCompleted = task?.status === 'completed';
  const isSubtask = task?.parentId !== null;
  const parentTask = task?.parentId
    ? tasks.find((t) => t.id === task.parentId) ?? null
    : null;
  const projectId = task?.projectId ?? parentTask?.projectId ?? null;
  const project = projectId
    ? projects.find((p) => p.id === projectId) ?? null
    : null;

  // --- Timer handlers ---

  const handleStartTimer = async (t: Task) => {
    setError(null);
    const result = await startTimer(t.id);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleStopTimer = async () => {
    if (!task) return;
    setError(null);
    const result = await stopTimer(task.id);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleSetWorkers = (n: number) => {
    if (task) setTimerWorkers(task.id, n);
  };

  const handleReactivate = async () => {
    if (task) await reactivateTask(task.id);
  };

  // --- Completion flow ---

  const checkParentCompletion = (parentId: string, excludeTaskId: string) => {
    const siblings = tasks.filter((t) => t.parentId === parentId);
    const allSiblingsDone = siblings
      .filter((t) => t.id !== excludeTaskId)
      .every((t) => t.status === 'completed');
    if (allSiblingsDone) {
      const parent = tasks.find((t) => t.id === parentId);
      if (parent && parent.status !== 'completed') {
        setLastCompletedSubtaskId(excludeTaskId);
        setCompletePromptParentId(parentId);
        setShowCompletePrompt(true);
      }
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    if (isTimerActive) {
      await stopTimer(task.id);
    }

    const incompleteSubtasks = subtasks.filter((t) => t.status !== 'completed');
    if (subtasks.length > 0 && incompleteSubtasks.length > 0) {
      setShowCompleteConfirm(true);
      return;
    }

    await completeTask(task.id);

    if (task.parentId) {
      checkParentCompletion(task.parentId, task.id);
    }
  };

  const handleCompleteSubtask = async (subtask: Task) => {
    if (activeTimers.some((t) => t.taskId === subtask.id)) {
      await stopTimer(subtask.id);
    }
    await completeTask(subtask.id);

    const allNowDone = subtasks
      .filter((t) => t.id !== subtask.id)
      .every((t) => t.status === 'completed');
    if (allNowDone && task && task.status !== 'completed') {
      setLastCompletedSubtaskId(subtask.id);
      setCompletePromptParentId(task.id);
      setShowCompletePrompt(true);
    }
  };

  const completionFlow: CompletionFlow = {
    showConfirm: showCompleteConfirm,
    showPrompt: showCompletePrompt,
    incompleteCount: subtasks.filter((t) => t.status !== 'completed').length,
    promptParentTitle: completePromptParentId
      ? (tasks.find((t) => t.id === completePromptParentId)?.title ?? 'parent task')
      : '',
    handleComplete,
    handleConfirmCompleteOnly: async () => {
      if (task) await completeTask(task.id);
      setShowCompleteConfirm(false);
    },
    handleConfirmCompleteAll: async () => {
      if (task) await completeTaskAndChildren(task.id);
      setShowCompleteConfirm(false);
    },
    handlePromptYes: async () => {
      if (completePromptParentId) {
        await completeTask(completePromptParentId);
      }
      setCompletePromptParentId(null);
      setLastCompletedSubtaskId(null);
      setShowCompletePrompt(false);
    },
    handlePromptNo: () => {
      setCompletePromptParentId(null);
      setLastCompletedSubtaskId(null);
      setShowCompletePrompt(false);
    },
    handlePromptCancel: async () => {
      if (lastCompletedSubtaskId) {
        await reactivateTask(lastCompletedSubtaskId);
      }
      setCompletePromptParentId(null);
      setLastCompletedSubtaskId(null);
      setShowCompletePrompt(false);
    },
    dismissConfirm: () => setShowCompleteConfirm(false),
  };

  // --- Delete flow ---

  const deleteFlow: DeleteFlow = {
    showConfirm: showDeleteConfirm,
    preview: deletePreview,
    isDeleting,
    handleDeleteClick: async () => {
      if (!task) return;
      // Stop any timers on this task or its subtasks
      const affectedIds = [task.id, ...subtasks.map((s) => s.id)];
      for (const id of affectedIds) {
        if (activeTimers.some((t) => t.taskId === id)) {
          await stopTimer(id);
        }
      }
      const preview = await getDeletePreview(task.id);
      if (preview) {
        setDeletePreview(preview);
        setShowDeleteConfirm(true);
      }
    },
    handleDeleteConfirm: async () => {
      if (!task) return;
      setIsDeleting(true);
      try {
        await deleteTaskWithEntries(task.id);
        setShowDeleteConfirm(false);
        onBack();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete task');
        setShowDeleteConfirm(false);
      } finally {
        setIsDeleting(false);
      }
    },
    dismissConfirm: () => {
      setShowDeleteConfirm(false);
      setDeletePreview(null);
    },
  };

  // --- Block flow ---

  const blockFlow: BlockFlow = {
    showInput: showBlockInput,
    reason: blockReason,
    setReason: setBlockReason,
    showBlockInput: () => setShowBlockInput(true),
    hideBlockInput: () => setShowBlockInput(false),
    handleBlock: async () => {
      if (!task || !blockReason.trim()) return;
      await blockTask(task.id, blockReason.trim());
      setBlockReason('');
      setShowBlockInput(false);
    },
    handleUnblock: async () => {
      if (task) await unblockTask(task.id);
    },
  };

  return {
    task,
    subtasks,
    parentTask,
    project,
    isTimerActive: !!isTimerActive,
    isBlocked: !!isBlocked,
    isCompleted: !!isCompleted,
    isSubtask: !!isSubtask,
    error,
    taskTimes,
    activeTimers,
    handleStartTimer,
    handleStopTimer,
    handleReactivate,
    handleSetWorkers,
    handleCompleteSubtask,
    completionFlow,
    deleteFlow,
    blockFlow,
    showProjectPicker,
    setShowProjectPicker,
    handleAssignProject: async (projectId: string | null) => {
      if (task) await assignToProject(task.id, projectId);
    },
  };
}
