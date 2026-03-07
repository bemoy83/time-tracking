import { Task, Project } from '../../lib/types';
import type { TaskTimes } from '../../lib/hooks/useTaskTimes';
import { TaskCard } from '../../components/TaskCard';
import { CountBadge } from '../../components/CountBadge';
import { TaskListIcon } from '../../components/icons';
import { getContrastColor } from '../../lib/utils/contrast';

interface ActiveSectionProps {
  ungroupedTasks: Task[];
  groupedTasks: { project: Project; tasks: Task[] }[];
  activeTimerTaskIds: Set<string>;
  expandedTaskIds: Set<string>;
  taskTimes: TaskTimes;
  onSelectTask: (task: Task) => void;
  onStartTimer: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onToggleExpanded: (taskId: string) => void;
  resolveProjectColor: (task: Pick<Task, 'projectId'>) => string | undefined;
  getSubtaskProgress: (parentId: string) => { completed: number; total: number } | null;
  getSubtasks: (parentId: string) => Task[];
}

export function ActiveSection({
  ungroupedTasks,
  groupedTasks,
  activeTimerTaskIds,
  expandedTaskIds,
  taskTimes,
  onSelectTask,
  onStartTimer,
  onCompleteTask,
  onToggleExpanded,
  resolveProjectColor,
  getSubtaskProgress,
  getSubtasks,
}: ActiveSectionProps) {
  const activeCount =
    ungroupedTasks.length + groupedTasks.reduce((sum, group) => sum + group.tasks.length, 0);

  if (activeCount === 0) {
    return null;
  }

  return (
    <section className="today-view__section today-view__section--active">
      <h2 className="today-view__section-title section-heading section-heading--active">
        <TaskListIcon className="today-view__icon" />
        Active
        <CountBadge count={activeCount} variant="muted" />
      </h2>

      {ungroupedTasks.length > 0 && (
        <div className="today-view__task-list">
          {ungroupedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              resolveProjectColor={resolveProjectColor}
              isTimerActive={activeTimerTaskIds.has(task.id)}
              totalMs={taskTimes.durationByTask.get(task.id)}
              totalPersonMs={taskTimes.personMsByTask.get(task.id)}
              taskTimes={taskTimes}
              progress={getSubtaskProgress(task.id)}
              isExpanded={expandedTaskIds.has(task.id)}
              subtasks={getSubtasks(task.id)}
              onSelect={() => onSelectTask(task)}
              onSelectTask={onSelectTask}
              onStartTimer={() => onStartTimer(task)}
              onStartTimerForTask={onStartTimer}
              onComplete={() => onCompleteTask(task)}
              onCompleteTask={onCompleteTask}
              onExpandToggle={() => onToggleExpanded(task.id)}
            />
          ))}
        </div>
      )}

      {groupedTasks.map(({ project, tasks }) => (
        <div key={project.id} className="today-view__task-group">
          <h3 className="today-view__subsection-title section-heading">
            <span
              className="today-view__project-badge"
              style={{
                backgroundColor: project.color,
                color: getContrastColor(project.color),
              }}
            >
              {project.name}
            </span>
            <CountBadge count={tasks.length} variant="muted" />
          </h3>
          <div className="today-view__task-list">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                resolveProjectColor={resolveProjectColor}
                isTimerActive={activeTimerTaskIds.has(task.id)}
                totalMs={taskTimes.durationByTask.get(task.id)}
                totalPersonMs={taskTimes.personMsByTask.get(task.id)}
                taskTimes={taskTimes}
                progress={getSubtaskProgress(task.id)}
                isExpanded={expandedTaskIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSelect={() => onSelectTask(task)}
                onSelectTask={onSelectTask}
                onStartTimer={() => onStartTimer(task)}
                onStartTimerForTask={onStartTimer}
                onComplete={() => onCompleteTask(task)}
                onCompleteTask={onCompleteTask}
                onExpandToggle={() => onToggleExpanded(task.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
