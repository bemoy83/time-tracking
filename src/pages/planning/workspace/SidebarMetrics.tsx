import { MetricCard } from '../../../components/MetricCard';
import type { ResolvedMetrics } from './workspace-metrics';

interface SidebarMetricsProps {
  metrics: ResolvedMetrics;
}

export function SidebarMetrics({ metrics }: SidebarMetricsProps) {
  return (
    <div className="planning-workspace__sidebar-metrics">
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
