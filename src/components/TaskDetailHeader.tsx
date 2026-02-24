/**
 * TaskDetailHeader component.
 * Back-nav breadcrumb bar + editable title.
 * Uses shared BreadcrumbNav and EditableTitle components.
 */

import { Task, Project } from '../lib/types';
import { updateTaskTitle } from '../lib/stores/task-store';
import { BreadcrumbNav, BreadcrumbSegment } from './BreadcrumbNav';
import { EditableTitle } from './EditableTitle';
import { ProjectColorDot } from './ProjectColorDot';

interface TaskDetailHeaderProps {
  task: Task;
  project: Project | null;
  parentTask: Task | null;
  onBack: () => void;
  onNavigateToProject?: (project: Project) => void;
  onNavigateToParent?: () => void;
  onShowProjectPicker: () => void;
}

export function TaskDetailHeader({
  task,
  project,
  parentTask,
  onBack,
  onNavigateToProject,
  onNavigateToParent,
  onShowProjectPicker,
}: TaskDetailHeaderProps) {
  const hasBreadcrumb = project || parentTask;

  const segments: BreadcrumbSegment[] = [];
  if (project) {
    segments.push({
      label: project.name,
      icon: <ProjectColorDot color={project.color} size="sm" />,
      onClick: () => onNavigateToProject?.(project),
    });
  }
  if (parentTask) {
    segments.push({
      label: parentTask.title,
      onClick: onNavigateToParent,
    });
  }

  const trailing = !hasBreadcrumb ? (
    <button
      className="breadcrumb-nav__add"
      onClick={onShowProjectPicker}
    >
      + Add to project
    </button>
  ) : undefined;

  return (
    <div className="task-detail__title-section">
      <BreadcrumbNav onBack={onBack} segments={segments} trailing={trailing} />
      <EditableTitle
        value={task.title}
        onSave={(newTitle) => updateTaskTitle(task.id, newTitle)}
        className="task-detail__title"
      />
    </div>
  );
}
