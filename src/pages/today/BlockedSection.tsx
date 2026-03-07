import { Task } from '../../lib/types';
import { CountBadge } from '../../components/CountBadge';
import { SwipeableTaskRow } from '../../components/SwipeableTaskRow';
import { WarningIcon } from '../../components/icons';

interface BlockedSectionProps {
  blockedTasks: Task[];
  getTotalMs: (task: Task) => number | undefined;
  getProjectColor: (task: Task) => string | undefined;
  onSelectTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
}

export function BlockedSection({
  blockedTasks,
  getTotalMs,
  getProjectColor,
  onSelectTask,
  onCompleteTask,
}: BlockedSectionProps) {
  if (blockedTasks.length === 0) {
    return null;
  }

  return (
    <section className="today-view__section today-view__section--blocked">
      <h2 className="today-view__section-title section-heading section-heading--blocked">
        <WarningIcon className="today-view__icon" />
        Blocked
        <CountBadge count={blockedTasks.length} variant="muted" />
      </h2>
      <div className="today-view__task-list">
        {blockedTasks.map((task) => (
          <SwipeableTaskRow
            key={task.id}
            task={task}
            projectColor={getProjectColor(task)}
            totalMs={getTotalMs(task)}
            onSelect={onSelectTask}
            onComplete={() => onCompleteTask(task)}
          />
        ))}
      </div>
    </section>
  );
}
