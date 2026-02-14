/**
 * TaskDetail page.
 * Shows task details with timer controls always visible.
 *
 * Design requirements from PLAN.md:
 * - Large title
 * - Prominent status section
 * - Timer controls always visible
 * - Secondary data collapsible by default
 * - Editing exists but never blocks timing
 */

import { useState } from 'react';
import { Task, Project } from '../lib/types';
import { PlayIcon, StopIcon, CheckIcon, TrashIcon } from '../components/icons';
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
} from '../lib/stores/task-store';
import {
  useTimerStore,
  startTimer,
  stopTimer,
} from '../lib/stores/timer-store';
import { TimerDisplay } from '../components/TimerDisplay';
import { TaskTimeTracking } from '../components/TaskTimeTracking';
import { TaskDetailHeader } from '../components/TaskDetailHeader';
import { TaskDetailSubtasks } from '../components/TaskDetailSubtasks';
import { DeleteTaskConfirm } from '../components/DeleteTaskConfirm';
import { ProjectPicker } from '../components/ProjectPicker';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';

interface TaskDetailProps {
  taskId: string;
  onBack: () => void;
  onSelectTask: (task: Task) => void;
  onNavigateToProject?: (project: Project) => void;
}

export function TaskDetail({ taskId, onBack, onSelectTask, onNavigateToProject }: TaskDetailProps) {
  const task = useTask(taskId);
  const subtasks = useSubtasks(taskId);
  const { tasks, projects } = useTaskStore();
  const { activeTimer } = useTimerStore();

  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);
  const [completePromptParentId, setCompletePromptParentId] = useState<string | null>(null);

  if (!task) {
    return (
      <div className="task-detail">
        <button className="task-detail__back" onClick={onBack}>
          &larr; Back
        </button>
        <p>Task not found.</p>
      </div>
    );
  }

  const isTimerActive = activeTimer?.taskId === task.id;
  const isBlocked = task.status === 'blocked';
  const isCompleted = task.status === 'completed';
  const isSubtask = task.parentId !== null;
  const project = task.projectId
    ? projects.find((p) => p.id === task.projectId)
    : null;

  const handleStartTimerForTask = async (t: Task) => {
    setError(null);
    const result = await startTimer(t.id);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleStopTimer = async () => {
    setError(null);
    const result = await stopTimer();
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleComplete = async () => {
    if (isTimerActive) {
      await stopTimer();
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

  const checkParentCompletion = (parentId: string, excludeTaskId: string) => {
    const siblings = tasks.filter((t) => t.parentId === parentId);
    const allSiblingsDone = siblings
      .filter((t) => t.id !== excludeTaskId)
      .every((t) => t.status === 'completed');
    if (allSiblingsDone) {
      const parent = tasks.find((t) => t.id === parentId);
      if (parent && parent.status !== 'completed') {
        setCompletePromptParentId(parentId);
        setShowCompletePrompt(true);
      }
    }
  };

  const handleConfirmCompleteOnly = async () => {
    await completeTask(task.id);
    setShowCompleteConfirm(false);
  };

  const handleConfirmCompleteAll = async () => {
    await completeTaskAndChildren(task.id);
    setShowCompleteConfirm(false);
  };

  const handlePromptYes = async () => {
    if (completePromptParentId) {
      await completeTask(completePromptParentId);
    }
    setCompletePromptParentId(null);
    setShowCompletePrompt(false);
  };

  const handleCompleteSubtask = async (subtask: Task) => {
    if (activeTimer?.taskId === subtask.id) {
      await stopTimer();
    }
    await completeTask(subtask.id);

    const allNowDone = subtasks
      .filter((t) => t.id !== subtask.id)
      .every((t) => t.status === 'completed');
    if (allNowDone && task.status !== 'completed') {
      setCompletePromptParentId(task.id);
      setShowCompletePrompt(true);
    }
  };

  const handleDeleteClick = async () => {
    if (activeTimer?.taskId === task.id || subtasks.some(s => activeTimer?.taskId === s.id)) {
      await stopTimer();
    }
    const preview = await getDeletePreview(task.id);
    if (preview) {
      setDeletePreview(preview);
      setShowDeleteConfirm(true);
    }
  };

  const handleDeleteConfirm = async () => {
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
  };

  return (
    <div className="task-detail">
      <TaskDetailHeader
        task={task}
        project={project ?? null}
        onBack={onBack}
        onNavigateToProject={onNavigateToProject}
        onShowProjectPicker={() => setShowProjectPicker(true)}
      />

      {/* Error display */}
      {error && (
        <div className="task-detail__error" role="alert">
          {error}
        </div>
      )}

      {/* Status section */}
      <div
        className={`task-detail__status ${
          isBlocked
            ? 'task-detail__status--blocked'
            : isCompleted
            ? 'task-detail__status--completed'
            : isTimerActive
            ? 'task-detail__status--active'
            : ''
        }`}
      >
        {isBlocked && (
          <>
            <span className="task-detail__status-badge">Blocked</span>
            <span className="task-detail__blocked-reason">{task.blockedReason}</span>
          </>
        )}
        {isCompleted && <span className="task-detail__status-badge">Completed</span>}
        {isTimerActive && (
          <>
            <span className="task-detail__status-badge">Recording</span>
            <TimerDisplay size="large" />
          </>
        )}
        {!isBlocked && !isCompleted && !isTimerActive && (
          <span className="task-detail__status-badge">Active</span>
        )}
      </div>

      {/* Timer controls */}
      <div className="task-detail__timer-controls">
        {isTimerActive ? (
          <button
            className="task-detail__timer-btn task-detail__timer-btn--stop"
            onClick={handleStopTimer}
          >
            <StopIcon className="task-detail__icon" />
            Stop Timer
          </button>
        ) : (
          <button
            className="task-detail__timer-btn task-detail__timer-btn--start"
            onClick={() => handleStartTimerForTask(task)}
            disabled={isBlocked || isCompleted}
          >
            <PlayIcon className="task-detail__icon" />
            Start Timer
          </button>
        )}
      </div>

      <TaskTimeTracking taskId={task.id} subtaskIds={subtasks.map((s) => s.id)} />

      {/* Action buttons */}
      <div className="task-detail__actions">
        {!isCompleted && !isBlocked && (
          <button className="task-detail__btn task-detail__btn--complete" onClick={handleComplete}>
            <CheckIcon className="task-detail__icon" />
            Complete
          </button>
        )}

        {isCompleted && (
          <button className="task-detail__btn task-detail__btn--secondary" onClick={() => reactivateTask(task.id)}>
            Reactivate
          </button>
        )}

        {isBlocked && (
          <button className="task-detail__btn task-detail__btn--unblock" onClick={() => unblockTask(task.id)}>
            Unblock
          </button>
        )}

        {!isBlocked && !isCompleted && (
          <>
            {showBlockInput ? (
              <div className="task-detail__block-input">
                <input
                  type="text"
                  placeholder="Reason for blocking..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="task-detail__input"
                />
                <button
                  className="task-detail__btn task-detail__btn--block"
                  onClick={async () => {
                    if (!blockReason.trim()) return;
                    await blockTask(task.id, blockReason.trim());
                    setBlockReason('');
                    setShowBlockInput(false);
                  }}
                  disabled={!blockReason.trim()}
                >
                  Block
                </button>
                <button
                  className="task-detail__btn task-detail__btn--secondary"
                  onClick={() => setShowBlockInput(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="task-detail__btn task-detail__btn--secondary"
                onClick={() => setShowBlockInput(true)}
              >
                Mark Blocked
              </button>
            )}
          </>
        )}

        <button
          className="task-detail__btn task-detail__btn--delete"
          onClick={handleDeleteClick}
          disabled={isDeleting}
        >
          <TrashIcon className="task-detail__icon" />
          Delete
        </button>
      </div>

      {/* Subtasks section */}
      {!isSubtask && (
        <TaskDetailSubtasks
          task={task}
          subtasks={subtasks}
          onSelectTask={onSelectTask}
          onStartTimer={handleStartTimerForTask}
          onStopTimer={handleStopTimer}
          onCompleteSubtask={handleCompleteSubtask}
        />
      )}

      {/* Dialogs */}
      <ProjectPicker
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        onSelect={(projectId) => assignToProject(task.id, projectId)}
        currentProjectId={task.projectId}
      />
      <DeleteTaskConfirm
        isOpen={showDeleteConfirm}
        taskTitle={task.title}
        totalTimeMs={deletePreview?.totalTimeMs ?? 0}
        subtaskCount={deletePreview?.subtaskCount ?? 0}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setShowDeleteConfirm(false); setDeletePreview(null); }}
      />
      <CompleteParentConfirm
        isOpen={showCompleteConfirm}
        taskTitle={task.title}
        incompleteCount={subtasks.filter((t) => t.status !== 'completed').length}
        onCompleteOnly={handleConfirmCompleteOnly}
        onCompleteAll={handleConfirmCompleteAll}
        onCancel={() => setShowCompleteConfirm(false)}
      />
      <CompleteParentPrompt
        isOpen={showCompletePrompt}
        parentTitle={
          completePromptParentId
            ? (tasks.find((t) => t.id === completePromptParentId)?.title ?? 'parent task')
            : ''
        }
        onYes={handlePromptYes}
        onNo={() => { setCompletePromptParentId(null); setShowCompletePrompt(false); }}
      />
    </div>
  );
}
