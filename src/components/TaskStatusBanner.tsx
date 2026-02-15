/**
 * TaskStatusBanner component.
 * Shows visual status indicator: blocked, completed, or recording.
 * No action buttons — those live in TaskActionBar.
 */

import { ActiveTimer } from '../lib/types';
import { TimerDisplay } from './TimerDisplay';
import { WorkersStepper } from './WorkersStepper';

interface TaskStatusBannerProps {
  status: 'active' | 'completed' | 'blocked';
  blockedReason?: string | null;
  isTimerActive: boolean;
  activeTimer?: ActiveTimer | null;
  onSetWorkers?: (n: number) => void;
}

export function TaskStatusBanner({
  status,
  blockedReason,
  isTimerActive,
  activeTimer,
  onSetWorkers,
}: TaskStatusBannerProps) {
  if (status === 'blocked') {
    return (
      <div className="task-detail__status-control task-detail__status-control--blocked">
        <span className="task-detail__status-dot" />
        <div className="task-detail__status-info">
          <span className="task-detail__status-label">Blocked</span>
          {blockedReason && (
            <span className="task-detail__blocked-reason">{blockedReason}</span>
          )}
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="task-detail__status-control task-detail__status-control--completed">
        <span className="task-detail__status-dot" />
        <span className="task-detail__status-label">Completed</span>
      </div>
    );
  }

  if (isTimerActive) {
    return (
      <div className="task-detail__status-control task-detail__status-control--recording-group">
        <div className="task-detail__status-control task-detail__status-control--recording">
          <span className="task-detail__status-label">Recording</span>
          <TimerDisplay size="large" />
        </div>
        <div className="task-detail__workers-row">
          <span className="task-detail__workers-label">Workers</span>
          <WorkersStepper
            value={activeTimer?.workers ?? 1}
            onChange={(n) => onSetWorkers?.(n)}
            size="compact"
          />
        </div>
      </div>
    );
  }

  // Active idle — no banner needed, action bar has Start button
  return null;
}
