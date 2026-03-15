import type { CSSProperties } from 'react';
import type { SidebarMetricDescriptor } from './workspace/workspace-metrics';

interface PlanKpiRowProps {
  metrics: SidebarMetricDescriptor[];
}

export function PlanKpiRow({ metrics }: PlanKpiRowProps) {
  return (
    <div className="planning-view__kpi-row">
      {metrics.map((m, i) => (
        <div
          key={i}
          className={`planning-view__kpi-card${m.variant === 'risk' ? ' planning-view__kpi-card--risk' : ''}${m.ring ? ' planning-view__kpi-card--has-ring' : ''}`}
        >
          {m.icon && <div className="planning-view__kpi-card-ico">{m.icon}</div>}
          <span className="planning-view__kpi-card-val">{m.value}</span>
          <span className="planning-view__kpi-card-lbl">{m.label}</span>
          {m.ring && (
            <div
              className={`planning-view__kpi-ring${m.ring.isComplete ? ' planning-view__kpi-ring--complete' : ''}`}
              style={{ '--kpi-ring-progress': m.ring.ratio } as CSSProperties}
              role="img"
              aria-label={`${Math.round(m.ring.ratio * 100)}% scheduled`}
            >
              <span className="planning-view__kpi-ring-value">{Math.round(m.ring.ratio * 100)}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
