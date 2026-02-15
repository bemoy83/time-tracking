/**
 * TimerDisplay component.
 * Shows elapsed time calculated from timestamps.
 * Updates on a visual interval for display only - actual time is always from timestamps.
 */

import { useEffect, useState } from 'react';
import { useTimerStore } from '../lib/stores/timer-store';
import { elapsedMs, formatDuration } from '../lib/types';

interface TimerDisplayProps {
  /** Size variant */
  size?: 'normal' | 'large';
  /** Task ID to show timer for; omit to show sum of all active timers */
  taskId?: string;
}

/**
 * Displays the current elapsed time.
 * Uses timestamps for accuracy - the interval is only for UI updates.
 */
export function TimerDisplay({ size = 'normal', taskId }: TimerDisplayProps) {
  const { activeTimers } = useTimerStore();
  const [displayMs, setDisplayMs] = useState(0);

  // Find relevant timer(s)
  const relevantTimers = taskId
    ? activeTimers.filter((t) => t.taskId === taskId)
    : activeTimers;

  const timerKey = relevantTimers.map((t) => t.id).join(',');

  useEffect(() => {
    if (relevantTimers.length === 0) {
      setDisplayMs(0);
      return;
    }

    const calcElapsed = () =>
      relevantTimers.reduce((sum, t) => sum + elapsedMs(t.startUtc), 0);

    setDisplayMs(calcElapsed());

    const interval = setInterval(() => {
      setDisplayMs(calcElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [timerKey]);

  const isActive = relevantTimers.length > 0;
  const formatted = formatDuration(displayMs);

  return (
    <div
      className={`timer-display ${isActive ? 'timer-display--active' : ''} ${
        size === 'large' ? 'timer-display--large' : ''
      }`}
      role="timer"
      aria-live="polite"
      aria-label={isActive ? `Timer running: ${formatted}` : 'Timer stopped'}
    >
      <span className="timer-display__time">{formatted}</span>
      {isActive && <span className="timer-display__indicator" aria-hidden="true" />}
    </div>
  );
}
