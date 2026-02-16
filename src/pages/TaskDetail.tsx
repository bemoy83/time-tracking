/**
 * TaskDetail page.
 * Pure view component — all logic lives in useTaskDetail hook.
 * Renders status banner, expandable sections, and fixed action bar.
 */

import { Task, Project } from '../lib/types';
import { TrashIcon, HomeIcon } from '../components/icons';
import { useTaskDetail } from '../lib/hooks/useTaskDetail';
import { TaskDetailHeader } from '../components/TaskDetailHeader';
import { TaskStatusBanner } from '../components/TaskStatusBanner';
import { TaskActionBar } from '../components/TaskActionBar';
import { TaskTimeTracking } from '../components/TaskTimeTracking';
import { TaskNotes } from '../components/TaskNotes';
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
  const detail = useTaskDetail(taskId, onBack);

  if (!detail.task) {
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

  const { task, subtasks, parentTask, project } = detail;

  return (
    <div className="task-detail">
      {/* 1. Header (breadcrumb + title) */}
      <TaskDetailHeader
        task={task}
        project={project ?? null}
        parentTask={parentTask}
        onBack={onBack}
        onNavigateToProject={onNavigateToProject}
        onNavigateToParent={parentTask ? () => onSelectTask(parentTask) : undefined}
        onShowProjectPicker={() => detail.setShowProjectPicker(true)}
      />

      {/* 2. Error display */}
      {detail.error && (
        <div className="task-detail__error" role="alert">
          {detail.error}
        </div>
      )}

      {/* 3. Status banner (blocked/completed/recording) */}
      <TaskStatusBanner
        status={task.status}
        blockedReason={task.blockedReason}
        isTimerActive={detail.isTimerActive}
        activeTimer={detail.activeTimers.find((t) => t.taskId === task.id)}
        taskId={task.id}
        onSetWorkers={detail.handleSetWorkers}
      />

      {/* 4. Time Tracking (expandable, default open) */}
      <TaskTimeTracking taskId={task.id} subtaskIds={subtasks.map((s) => s.id)} />

      {/* 5. Notes (expandable, default closed) */}
      <TaskNotes taskId={task.id} />

      {/* 6. Subtasks (expandable, default open, parent tasks only) */}
      {!detail.isSubtask && (
        <TaskDetailSubtasks
          task={task}
          subtasks={subtasks}
          taskTimes={detail.taskTimes}
          onSelectTask={onSelectTask}
          onStartTimer={detail.handleStartTimer}
          onCompleteSubtask={detail.handleCompleteSubtask}
        />
      )}

      {/* 7. Block input (secondary inline action) */}
      {!detail.isBlocked && !detail.isCompleted && (
        <div className="task-detail__actions">
          {detail.blockFlow.showInput ? (
            <div className="task-detail__block-input">
              <input
                type="text"
                placeholder="Reason for blocking..."
                value={detail.blockFlow.reason}
                onChange={(e) => detail.blockFlow.setReason(e.target.value)}
                className="input"
              />
              <button
                className="btn btn--warning btn--full"
                onClick={detail.blockFlow.handleBlock}
                disabled={!detail.blockFlow.reason.trim()}
              >
                Block
              </button>
              <button
                className="btn btn--secondary btn--full"
                onClick={detail.blockFlow.hideBlockInput}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn btn--secondary btn--full"
              onClick={detail.blockFlow.showBlockInput}
            >
              Mark Blocked
            </button>
          )}
        </div>
      )}

      {/* 8. Delete link (bottom of scroll) */}
      <button
        className="task-detail__delete-link"
        onClick={detail.deleteFlow.handleDeleteClick}
        disabled={detail.deleteFlow.isDeleting}
      >
        <TrashIcon className="task-detail__delete-link-icon" />
        Delete Task
      </button>

      {/* 9. Action bar (fixed bottom) */}
      <TaskActionBar
        status={task.status}
        isTimerActive={detail.isTimerActive}
        onStartTimer={() => detail.handleStartTimer(task)}
        onStopTimer={detail.handleStopTimer}
        onComplete={detail.completionFlow.handleComplete}
        onUnblock={detail.blockFlow.handleUnblock}
        onReactivate={detail.handleReactivate}
      />

      {/* 10. Modal dialogs */}
      <ProjectPicker
        isOpen={detail.showProjectPicker}
        onClose={() => detail.setShowProjectPicker(false)}
        onSelect={(projectId) => detail.handleAssignProject(projectId)}
        currentProjectId={task.projectId}
      />
      <DeleteTaskConfirm
        isOpen={detail.deleteFlow.showConfirm}
        taskTitle={task.title}
        totalTimeMs={detail.deleteFlow.preview?.totalTimeMs ?? 0}
        subtaskCount={detail.deleteFlow.preview?.subtaskCount ?? 0}
        onConfirm={detail.deleteFlow.handleDeleteConfirm}
        onCancel={detail.deleteFlow.dismissConfirm}
      />
      <CompleteParentConfirm
        isOpen={detail.completionFlow.showConfirm}
        taskTitle={task.title}
        incompleteCount={detail.completionFlow.incompleteCount}
        onCompleteOnly={detail.completionFlow.handleConfirmCompleteOnly}
        onCompleteAll={detail.completionFlow.handleConfirmCompleteAll}
        onCancel={detail.completionFlow.dismissConfirm}
      />
      <CompleteParentPrompt
        isOpen={detail.completionFlow.showPrompt}
        parentTitle={detail.completionFlow.promptParentTitle}
        onYes={detail.completionFlow.handlePromptYes}
        onNo={detail.completionFlow.handlePromptNo}
        onCancel={detail.completionFlow.handlePromptCancel}
      />
    </div>
  );
}
