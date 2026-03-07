import { Task } from '../../lib/types';
import { CompletedSection } from '../../components/CompletedSection';

interface CompletedSectionContainerProps {
  completedTasks: Task[];
  getTotalMs: (task: Task) => number | undefined;
  getProjectColor: (task: Task) => string | undefined;
  onSelectTask: (task: Task) => void;
}

export function CompletedSectionContainer({
  completedTasks,
  getTotalMs,
  getProjectColor,
  onSelectTask,
}: CompletedSectionContainerProps) {
  if (completedTasks.length === 0) {
    return null;
  }

  return (
    <CompletedSection
      tasks={completedTasks}
      getTotalMs={getTotalMs}
      getProjectColor={getProjectColor}
      onSelectTask={onSelectTask}
      sectionClassName="today-view__section today-view__section--completed section--completed"
      contentId="today-view__completed-list"
    />
  );
}
