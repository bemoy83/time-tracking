import type { ReactNode } from 'react';

type MetricCardIconVariant = 'tasks' | 'done' | 'time' | 'people' | 'blocked' | 'estimate';
type MetricCardVariant = 'default' | 'risk';

export interface MetricCardProps {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  iconVariant?: MetricCardIconVariant;
  meta?: string;
  variant?: MetricCardVariant;
}

export function MetricCard({
  value,
  label,
  icon,
  iconVariant,
  meta,
  variant = 'default',
}: MetricCardProps) {
  const cardClassName = variant === 'risk' ? 'metric-card metric-card--risk' : 'metric-card';
  const valueClassName = variant === 'risk' ? 'metric-card__value metric-card__value--risk' : 'metric-card__value';
  const iconClassName = iconVariant
    ? `metric-card__icon metric-card__icon--${iconVariant}`
    : 'metric-card__icon';

  return (
    <div className={cardClassName}>
      {icon && <span className={iconClassName}>{icon}</span>}
      <span className={valueClassName}>{value}</span>
      <span className="metric-card__label">{label}</span>
      {meta && <span className="metric-card__meta">{meta}</span>}
    </div>
  );
}
