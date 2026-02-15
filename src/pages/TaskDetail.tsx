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
import { PlayIcon, StopIcon, CheckIcon, TrashIcon, HomeIcon } from '../components/icons';
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
  setTimerWorkers,
} from '../lib/stores/timer-store';
import { TimerDisplay } from '../components/TimerDisplay';
import { TaskTimeTracking } from '../components/TaskTimeTracking';
import { TaskDetailHeader } from '../components/TaskDetailHeader';
import { TaskDetailSubtasks } from '../components/TaskDetailSubtasks';
import { DeleteTaskConfirm } from '../components/DeleteTaskConfirm';
import { ProjectPicker } from '../components/ProjectPicker';
import { CompleteParentConfirm } from '../components/CompleteParentConfirm';
import { CompleteParentPrompt } from '../components/CompleteParentPrompt';
import { WorkersStepper } from '../components/WorkersStepper';

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
  const [lastCompletedSubtaskId, setLastCompletedSubtaskId] = useState<string | null>(null);

  if (!task) {
    return (
      <div className="task-detail">
        <nav className="task-detail__breadcrumb">
          <button className="task-detail__breadcrumb-back" onClick={onBack}>
            <HomeIcon className="task-detail__breadcrumb-back-icon" />
          </button>
        </nav>
        <p>Task not found.</p>
      </div>
    );
  }

  const isTimerActive = activeTimer?.taskId === task.id;
  const isBlocked = task.status === 'blocked';
  const isCompleted = task.status === 'completed';
  const isSubtask = task.parentId !== null;
  const parentTask = task.parentId
    ? tasks.find((t) => t.id === task.parentId) ?? null
    : null;
  const projectId = task.projectId ?? parentTask?.projectId ?? null;
  const project = projectId
    ? projects.find((p) => p.id === projectId) ?? null
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
      checkParentCompletion(task.parentId, task.id, task.id);
    }
  };

  const checkParentCompletion = (parentId: string, excludeTaskId: string, completedTaskId: string) => {
    const siblings = tasks.filter((t) => t.parentId === parentId);
    const allSiblingsDone = siblings
      .filter((t) => t.id !== excludeTaskId)
      .every((t) => t.status === 'completed');
    if (allSiblingsDone) {
      const parent = tasks.find((t) => t.id === parentId);
      if (parent && parent.status !== 'completed') {
        setLastCompletedSubtaskId(completedTaskId);
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
    setLastCompletedSubtaskId(null);
    setShowCompletePrompt(false);
  };

  const handlePromptCancel = async () => {
    if (lastCompletedSubtaskId) {
      await reactivateTask(lastCompletedSubtaskId);
    }
    setCompletePromptParentId(null);
    setLastCompletedSubtaskId(null);
    setShowCompletePrompt(false);
  };

  const handlePromptNo = () => {
    setCompletePromptParentId(null);
    setLastCompletedSubtaskId(null);
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
      setLastCompletedSubtaskId(subtask.id);
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
        parentTask={parentTask}
        onBack={onBack}
        onNavigateToProject={onNavigateToProject}
        onNavigateToParent={parentTask ? () => onSelectTask(parentTask) : undefined}
        onShowProjectPicker={() => setShowProjectPicker(true)}
      />

      {/* Error display */}
      {error && (
        <div className="task-detail__error" role="alert">
          {error}
        </div>
      )}

      {/* Unified status + timer control */}
      {isBlocked ? (
        <div className="task-detail__status-control task-detail__status-control--blocked">
          <span className="task-detail__status-dot" />
          <div className="task-detail__status-info">
            <span className="task-detail__status-label">Blocked</span>
            {task.blockedReason && (
              <span className="task-detail__blocked-reason">{task.blockedReason}</span>
            )}
          </div>
        </div>
      ) : isCompleted ? (
        <div className="task-detail__status-control task-detail__status-control--completed">
          <span className="task-detail__status-dot" />
          <span className="task-detail__status-label">Completed</span>
        </div>
      ) : isTimerActive ? (
        <div className="task-detail__status-control task-detail__status-control--recording-group">
          <button
            className="task-detail__status-control task-detail__status-control--recording"
            onClick={handleStopTimer}
          >
            <StopIcon className="task-detail__status-icon" />
            <span className="task-detail__status-label">Stop</span>
            <TimerDisplay size="large" />
          </button>
          <div className="task-detail__workers-row">
            <span className="task-detail__workers-label">Workers</span>
            <WorkersStepper
              value={activeTimer?.workers ?? 1}
              onChange={(n) => setTimerWorkers(n)}
              size="compact"
            />
          </div>
        </div>
      ) : (
        <button
          className="task-detail__status-control task-detail__status-control--active"
          onClick={() => handleStartTimerForTask(task)}
        >
          <PlayIcon className="task-detail__status-icon" />
          <span className="task-detail__status-label">Start Timer</span>
        </button>
      )}

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
                  className="input"
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
      </div>

      {/* Subtasks section */}
      {!isSubtask && (
        <TaskDetailSubtasks
          task={task}
          subtasks={subtasks}
          onSelectTask={onSelectTask}
          onStartTimer={handleStartTimerForTask}
          onCompleteSubtask={handleCompleteSubtask}
        />
      )}

      {/* Delete - separated at bottom */}
      <button
        className="task-detail__delete-link"
        onClick={handleDeleteClick}
        disabled={isDeleting}
      >
        <TrashIcon className="task-detail__delete-link-icon" />
        Delete Task
      </button>

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
        onNo={handlePromptNo}
        onCancel={handlePromptCancel}
      />
    </div>
  );
}
