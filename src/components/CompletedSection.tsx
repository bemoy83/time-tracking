import { useState } from 'react';
import { Task } from '../lib/types';
import { CheckIcon, ExpandChevronIcon } from './icons';
import { CountBadge } from './CountBadge';
import { SwipeableTaskRow } from './SwipeableTaskRow';

interface CompletedSectionProps {
  tasks: Task[];
  getTotalMs: (task: Task) => number | undefined;
  getProjectColor?: (task: Task) => string | undefined;
  onSelectTask: (task: Task) => void;
  sectionClassName: string;
  contentId: string;
  defaultExpanded?: boolean;
}

export function CompletedSection({
  tasks,
  getTotalMs,
  getProjectColor,
  onSelectTask,
  sectionClassName,
  contentId,
  defaultExpanded = false,
}: CompletedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className={sectionClassName}>
      <button
        type="button"
        className={`collapsible-section-toggle${isExpanded ? ' collapsible-section-toggle--expanded' : ''}`}
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={`Completed tasks, ${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}. ${isExpanded ? 'Collapse' : 'Expand'}`}
      >
        <CheckIcon className="collapsible-section__icon" />
        Completed
        <CountBadge count={tasks.length} variant="muted" />
        <ExpandChevronIcon className="collapsible-section__chevron" />
      </button>
      {isExpanded && (
        <div id={contentId} className="today-view__task-list">
          {tasks.map((task) => (
            <SwipeableTaskRow
              key={task.id}
              task={task}
              projectColor={getProjectColor?.(task)}
              totalMs={getTotalMs(task)}
              onSelect={onSelectTask}
            />
          ))}
        </div>
      )}
    </section>
  );
}
