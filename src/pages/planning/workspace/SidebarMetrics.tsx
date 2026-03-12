import type { CSSProperties } from 'react';
import { MetricCard } from '../../../components/MetricCard';
import type { ResolvedMetrics, ScheduleCoverageMetric } from './workspace-metrics';

interface SidebarMetricsProps {
  metrics: ResolvedMetrics;
  scheduleCoverage?: ScheduleCoverageMetric | null;
}

function formatHours(hours: number): string {
  const rounded = Number(hours.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function ScheduleCoverageRing({ metric }: { metric: ScheduleCoverageMetric }) {
  const ringStyle = { '--coverage-progress': metric.completionRatio } as CSSProperties;
  const pct = Math.round(metric.completionRatio * 100);
  const cardStateClass = metric.isComplete
    ? 'planning-workspace__coverage-card--complete'
    : 'planning-workspace__coverage-card--open';
  const statusText = metric.isComplete
    ? 'All required work is scheduled.'
    : `${formatHours(metric.unscheduledHours)}h unscheduled`;

  return (
    <div className={`planning-workspace__coverage-card ${cardStateClass}`}>
      <div
        className="planning-workspace__coverage-ring"
        style={ringStyle}
        role="img"
        aria-label={`${pct}% of required hours scheduled`}
      >
        <span className="planning-workspace__coverage-ring-value">{pct}%</span>
      </div>
      <div className="planning-workspace__coverage-copy">
        <span className="planning-workspace__coverage-label">{metric.label}</span>
        <span className="planning-workspace__coverage-value">
          {formatHours(metric.scheduledHours)}h / {formatHours(metric.totalHours)}h
        </span>
        <span className="planning-workspace__coverage-meta">{statusText}</span>
      </div>
    </div>
  );
}

export function SidebarMetrics({ metrics, scheduleCoverage }: SidebarMetricsProps) {
  return (
    <div className="planning-workspace__sidebar-metrics">
      {scheduleCoverage && <ScheduleCoverageRing metric={scheduleCoverage} />}
      {metrics.map((m, i) => (
        <MetricCard
          key={i}
          value={m.value}
          label={m.label}
          icon={m.icon}
          iconVariant={m.iconVariant}
          meta={m.meta}
          variant={m.variant}
        />
      ))}
    </div>
  );
}
