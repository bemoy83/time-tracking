/**
 * useTaskDetail hook.
 * Extracts all state and handlers from TaskDetail page into a reusable hook.
 */

import { useState, useMemo } from 'react';
import { Task, Project } from '../types';
import {
  useTask,
  useSubtasks,
  useTaskStore,
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
} from '../stores/timer-store';
import { useTaskTimes, type TaskTimes } from './useTaskTimes';
import { useCompletionFlow } from './useCompletionFlow';

interface CompletionFlow {
  showConfirm: boolean;
  showPrompt: boolean;
  incompleteCount: number;
  promptParentTitle: string;
  handleComplete: () => Promise<void>;
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
  taskTimes: TaskTimes;

  // Actions
  handleStartTimer: (t: Task) => Promise<void>;
  handleStopTimer: () => Promise<void>;
  handleReactivate: () => Promise<void>;
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

  // Completion flow — delegated to shared hook
  const activeTimerTaskIds = useMemo(
    () => new Set(activeTimers.map((t) => t.taskId)),
    [activeTimers],
  );
  const cf = useCompletionFlow(tasks, activeTimerTaskIds);

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

  const handleReactivate = async () => {
    if (task) await reactivateTask(task.id);
  };

  // --- Completion flow ---

  const completionFlow: CompletionFlow = {
    showConfirm: cf.confirmTarget !== null,
    showPrompt: cf.promptParent !== null,
    incompleteCount: cf.confirmTarget
      ? tasks.filter((t) => t.parentId === cf.confirmTarget!.id && t.status !== 'completed').length
      : 0,
    promptParentTitle: cf.promptParent?.title ?? 'parent task',
    handleComplete: () => (task ? cf.handleComplete(task) : Promise.resolve()),
    handleConfirmCompleteAll: cf.handleConfirmCompleteAll,
    handlePromptYes: cf.handlePromptYes,
    handlePromptNo: cf.dismissPrompt,
    handlePromptCancel: cf.handlePromptCancel,
    dismissConfirm: cf.dismissConfirm,
  };

  const handleCompleteSubtask = (subtask: Task) => cf.handleComplete(subtask);

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
    handleStartTimer,
    handleStopTimer,
    handleReactivate,
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
