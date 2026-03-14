/**
 * ProjectList page.
 * Lists all projects with large color dots, two-line rows (name + task stats),
 * and FAB for creating new projects.
 */

import { useMemo, useState } from 'react';
import { Project } from '../lib/types';
import { useTaskStore } from '../lib/stores/task-store';
import { ChevronIcon, TaskListIcon } from '../components/icons';
import { Fab } from '../components/Fab';
import { ProjectColorDot } from '../components/ProjectColorDot';
import { CreateProjectSheet } from '../components/CreateProjectSheet';
import {
  filterProjectsByTimeline,
  getTodayDateKey,
  type ProjectTimelineFilter,
} from '../lib/projects/project-list-filter';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const { projects, tasks } = useTaskStore();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [filter, setFilter] = useState<ProjectTimelineFilter>('all');

  const filteredProjects = useMemo(() => {
    return filterProjectsByTimeline(projects, filter, getTodayDateKey());
  }, [filter, projects]);

  const getTaskStats = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId && t.parentId === null);
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    return { completed, total: projectTasks.length };
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="project-list">
      <header className="project-list__header">
        <h1 className="project-list__title">Projects</h1>
      </header>

      {/* FAB + Create Flow */}
      <Fab onClick={() => setShowCreateSheet(true)} aria-label="New project" />
      <CreateProjectSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
      />

      {hasProjects && (
        <div className="project-list__filters">
          <div className="task-work-quantity__unit-pills" role="tablist" aria-label="Project timeline filter">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`task-work-quantity__unit-pill${filter === 'all' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'current'}
              className={`task-work-quantity__unit-pill${filter === 'current' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setFilter('current')}
            >
              Current
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'next-90d'}
              className={`task-work-quantity__unit-pill${filter === 'next-90d' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setFilter('next-90d')}
            >
              Next 90d
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'past'}
              className={`task-work-quantity__unit-pill${filter === 'past' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setFilter('past')}
            >
              Past
            </button>
          </div>
        </div>
      )}

      {/* Project list */}
      {filteredProjects.length > 0 ? (
        <div className="project-list__items">
          {filteredProjects.map((project) => {
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
        <div className="empty-state">
          <TaskListIcon className="empty-state__icon" />
          <p className="empty-state__heading">
            {hasProjects ? 'No projects in this window' : 'No projects yet'}
          </p>
          <p className="empty-state__text">
            {hasProjects ? 'Try another filter to see more imported events.' : 'Tap + to create your first project.'}
          </p>
        </div>
      )}
    </div>
  );
}
