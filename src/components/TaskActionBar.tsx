/**
 * TaskActionBar component.
 * Persistent fixed bottom bar with state-dependent action buttons.
 * Always reachable without scrolling.
 */

import { PlayIcon, StopIcon, CheckIcon } from './icons';
import { TimerDisplay } from './TimerDisplay';

interface TaskActionBarProps {
  status: 'active' | 'completed' | 'blocked';
  isTimerActive: boolean;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onComplete: () => void;
  onUnblock: () => void;
  onReactivate: () => void;
}

export function TaskActionBar({
  status,
  isTimerActive,
  onStartTimer,
  onStopTimer,
  onComplete,
  onUnblock,
  onReactivate,
}: TaskActionBarProps) {
  return (
    <div className="task-action-bar">
      {status === 'blocked' ? (
        <button className="task-action-bar__btn task-action-bar__btn--unblock" onClick={onUnblock}>
          Unblock
        </button>
      ) : status === 'completed' ? (
        <button className="task-action-bar__btn task-action-bar__btn--secondary" onClick={onReactivate}>
          Reactivate
        </button>
      ) : isTimerActive ? (
        <>
          <button className="task-action-bar__btn task-action-bar__btn--stop" onClick={onStopTimer}>
            <StopIcon className="task-action-bar__icon" />
            <span>Stop</span>
            <TimerDisplay size="large" />
          </button>
          <button className="task-action-bar__btn task-action-bar__btn--complete" onClick={onComplete}>
            <CheckIcon className="task-action-bar__icon" />
            Complete
          </button>
        </>
      ) : (
        <>
          <button className="task-action-bar__btn task-action-bar__btn--start" onClick={onStartTimer}>
            <PlayIcon className="task-action-bar__icon" />
            Start Timer
          </button>
          <button className="task-action-bar__btn task-action-bar__btn--complete" onClick={onComplete}>
            <CheckIcon className="task-action-bar__icon" />
            Complete
          </button>
        </>
      )}
    </div>
  );
}
