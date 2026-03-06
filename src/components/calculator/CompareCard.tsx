import { type WorkUnit, formatProductivity } from '../../lib/types';
import type { CalcResult, RateInfo } from './types';

export function CompareCard({
  label,
  rate,
  result,
  workUnit,
  isActive,
}: {
  label: string;
  rate: RateInfo;
  result: CalcResult;
  workUnit: WorkUnit;
  isActive: boolean;
}) {
  const value = result.type === 'crew'
    ? `${result.crewValue} ${result.crewValue === 1 ? 'worker' : 'workers'}`
    : result.timeFormatted!;

  return (
    <div className={`calculator__compare-card${isActive ? ' calculator__compare-card--active' : ''}`}>
      <span className="calculator__compare-card-label">{label}</span>
      <span className="calculator__compare-card-value">{value}</span>
      <span className="calculator__compare-card-rate">{formatProductivity(rate.rate, workUnit)}</span>
      {rate.confidence != null && (
        <span className={`kpi-badge kpi-badge--${rate.confidence}`}>
          {rate.confidence}
        </span>
      )}
    </div>
  );
}
