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
}

/**
 * Displays the current elapsed time.
 * Uses timestamps for accuracy - the interval is only for UI updates.
 */
export function TimerDisplay({ size = 'normal' }: TimerDisplayProps) {
  const { activeTimer } = useTimerStore();
  const [displayMs, setDisplayMs] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
      setDisplayMs(0);
      return;
    }

    // Calculate initial elapsed time from timestamp
    setDisplayMs(elapsedMs(activeTimer.startUtc));

    // Update display every second (visual only - actual time from timestamps)
    const interval = setInterval(() => {
      setDisplayMs(elapsedMs(activeTimer.startUtc));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const isActive = !!activeTimer;
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
