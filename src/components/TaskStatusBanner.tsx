/**
 * TaskStatusBanner component.
 * Shows visual status indicator: blocked, completed, or recording.
 * No action buttons — those live in TaskActionBar.
 */

import { TimerDisplay } from './TimerDisplay';
import { ClockIcon, WarningIcon, CheckIcon } from './icons';

interface TaskStatusBannerProps {
  status: 'active' | 'completed' | 'blocked';
  blockedReason?: string | null;
  isTimerActive: boolean;
  taskId?: string;
}

export function TaskStatusBanner({
  status,
  blockedReason,
  isTimerActive,
  taskId,
}: TaskStatusBannerProps) {
  if (status === 'blocked') {
    return (
      <div className="task-detail__status-control task-detail__status-control--blocked">
        <WarningIcon className="task-detail__status-icon" />
        <span className="task-detail__status-label">
          Blocked{blockedReason ? ` · ${blockedReason}` : ''}
        </span>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="task-detail__status-control task-detail__status-control--completed">
        <CheckIcon className="task-detail__status-icon" />
        <span className="task-detail__status-label">Completed</span>
      </div>
    );
  }

  if (isTimerActive) {
    return (
      <div className="task-detail__status-control task-detail__status-control--recording">
        <ClockIcon className="task-detail__status-icon" />
        <span className="task-detail__status-label">Recording</span>
        <TimerDisplay size="large" taskId={taskId} />
      </div>
    );
  }

  // Active idle — no banner needed, action bar has Start button
  return null;
}
