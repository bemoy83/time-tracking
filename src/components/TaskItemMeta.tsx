import { ProjectColorDot } from './ProjectColorDot';
import { ClockIcon } from './icons';

export type TaskTimeBadgeStatus = 'under' | 'approaching' | 'over';

interface TaskProjectDotProps {
  color?: string;
  className?: string;
}

export function TaskProjectDot({ color, className = '' }: TaskProjectDotProps) {
  if (!color) return null;
  return <ProjectColorDot color={color} size="sm" className={`task-item__project-dot ${className}`.trim()} />;
}

interface TaskRecordingDotProps {
  trailing?: boolean;
  className?: string;
}

export function TaskRecordingDot({ trailing = false, className = '' }: TaskRecordingDotProps) {
  const trailingClass = trailing ? ' task-item__recording-dot--trailing' : '';
  return (
    <span
      className={`task-item__recording-dot${trailingClass} ${className}`.trim()}
      aria-label="Timer running"
    />
  );
}

interface TaskTimeBadgeProps {
  text: string;
  status?: TaskTimeBadgeStatus;
}

export function TaskTimeBadge({ text, status }: TaskTimeBadgeProps) {
  const statusClass = status ? ` task-item__time-badge--${status}` : '';
  return (
    <span className={`task-item__time-badge${statusClass}`}>
      <ClockIcon className="task-item__time-badge-icon" />
      {text}
    </span>
  );
}
