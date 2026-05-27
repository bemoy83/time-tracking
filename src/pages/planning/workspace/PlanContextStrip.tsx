import type { CSSProperties } from 'react';
import { StatusBadge } from '../../../components/StatusBadge';
import type { Plan } from '../../../lib/planning/plan-model';
import type { StatusBadgeVariant } from '../../../components/StatusBadge';

export interface PlanContextPhase {
  id: 'assembly' | 'event' | 'dismantle';
  label: string;
  range: string;
}

export interface PlanContextStripProps {
  title: string;
  status: StatusBadgeVariant;
  projectAccentColor: string | null;
  phases: PlanContextPhase[];
}

function formatContextDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  if (start && end && start === end) return fmt(start);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  return fmt(end!);
}

export function getPlanContextPhases(plan: Plan): PlanContextPhase[] {
  const phases: PlanContextPhase[] = [];
  const assemblyRange = formatContextDateRange(plan.assemblyStartDate, plan.assemblyEndDate);
  const eventRange = formatContextDateRange(plan.eventStartDate, plan.eventEndDate);
  const dismantleRange = formatContextDateRange(plan.dismantleStartDate, plan.dismantleEndDate);

  if (assemblyRange) phases.push({ id: 'assembly', label: 'Assembly', range: assemblyRange });
  if (eventRange) phases.push({ id: 'event', label: 'Event', range: eventRange });
  if (dismantleRange) phases.push({ id: 'dismantle', label: 'Dismantle', range: dismantleRange });

  return phases;
}

export function PlanContextStrip({
  title,
  status,
  projectAccentColor,
  phases,
}: PlanContextStripProps) {
  const style = projectAccentColor
    ? { '--planning-workspace-project-accent': projectAccentColor } as CSSProperties
    : undefined;

  return (
    <div
      className={`planning-workspace__plan-context-bar${projectAccentColor ? ' planning-workspace__plan-context-bar--has-project' : ''}`}
      style={style}
    >
      <span className="planning-workspace__plan-context-title">{title}</span>
      <StatusBadge variant={status} />
      {phases.length > 0 && (
        <span className="planning-workspace__plan-context-phases">
          {phases.map((phase) => (
            <span
              key={phase.id}
              className={`planning-workspace__plan-context-phase planning-workspace__plan-context-phase--${phase.id}`}
            >
              <span className={`planning-workspace__plan-context-phase-dot planning-workspace__plan-context-phase-dot--${phase.id}`} />
              <span className="planning-workspace__plan-context-phase-label">{phase.label}</span>
              <span className="planning-workspace__plan-context-phase-date mono">{phase.range}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
