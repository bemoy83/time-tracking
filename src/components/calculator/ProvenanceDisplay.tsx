import { type WorkUnit, WORK_UNIT_LABELS, formatProductivity } from '../../lib/types';
import type { CalcResult, RateInfo } from './types';

function sourceLabelFromResult(result: CalcResult, activeRate: RateInfo): string {
  if (result.rateSource === 'template') {
    return `Expected${activeRate.templateName ? `: ${activeRate.templateName}` : ''}`;
  }
  if (result.rateSource === 'historical') {
    return `Historical avg (${activeRate.sampleCount} tasks)`;
  }
  return 'Manual rate';
}

export function ProvenanceDisplay({
  result,
  activeRate,
  workUnit,
}: {
  result: CalcResult;
  activeRate: RateInfo;
  workUnit: WorkUnit;
}) {
  const sourceLabel = sourceLabelFromResult(result, activeRate);

  const equation = result.type === 'crew'
    ? `${result.quantityUsed} ${WORK_UNIT_LABELS[workUnit]} / (time × ${formatProductivity(result.rateUsed, workUnit)})`
    : `${result.quantityUsed} ${WORK_UNIT_LABELS[workUnit]} / (crew × ${formatProductivity(result.rateUsed, workUnit)})`;

  return (
    <div className="calculator__provenance">
      <span className="calculator__provenance-item">Source: {sourceLabel}</span>
      <span className="calculator__provenance-item">Rate: {formatProductivity(result.rateUsed, workUnit)}</span>
      <span className="calculator__provenance-item">Equation: {equation}</span>
      {result.confidence != null && result.confidence !== 'high' && (
        <span className="calculator__provenance-item calculator__provenance-warning">
          {result.confidence === 'low'
            ? 'Low confidence — limited historical data'
            : result.confidence === 'medium'
              ? 'Medium confidence — more data will improve accuracy'
              : ''}
        </span>
      )}
    </div>
  );
}
