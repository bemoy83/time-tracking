/**
 * ProjectList page.
 * Lists all projects with large color dots, two-line rows (name + task stats),
 * and FAB for creating new projects.
 */

import { useState } from 'react';
import { Project } from '../lib/types';
import { useTaskStore } from '../lib/stores/task-store';
import { ChevronIcon, TaskListIcon } from '../components/icons';
import { ProjectColorDot } from '../components/ProjectColorDot';
import { CreateProjectSheet } from '../components/CreateProjectSheet';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const { projects, tasks } = useTaskStore();
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const getTaskStats = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId && t.parentId === null);
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    return { completed, total: projectTasks.length };
  };

  return (
    <div className="project-list">
      <header className="project-list__header">
        <h1 className="project-list__title">Projects</h1>
      </header>

      {/* FAB + Create Flow */}
      <button
        className="fab"
        onClick={() => setShowCreateSheet(true)}
        aria-label="New project"
      >+</button>
      <CreateProjectSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
      />

      {/* Project list */}
      {projects.length > 0 ? (
        <div className="project-list__items">
          {projects.map((project) => {
            const stats = getTaskStats(project.id);
            return (
              <button
                key={project.id}
                className="project-list__item"
                onClick={() => onSelectProject(project)}
              >
                <ProjectColorDot color={project.color} size="xl" />
                <div className="project-list__item-content">
                  <span className="project-list__item-name">{project.name}</span>
                  <span className="project-list__item-meta">
                    <TaskListIcon className="project-list__item-meta-icon" />
                    {stats.completed} / {stats.total}
                  </span>
                </div>
                <ChevronIcon className="project-list__chevron" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="project-list__empty">
          <p>No projects yet.</p>
          <p>Tap + to create one.</p>
        </div>
      )}
    </div>
  );
}
