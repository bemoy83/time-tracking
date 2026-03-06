import { type WorkUnit, WORK_UNIT_LABELS, formatProductivity } from '../../lib/types';
import {
  type CalculatorScenario,
  type ScenarioComputed,
  validationReasonLabel,
} from '../../lib/calculator-scenarios';
import { WorkersStepper } from '../WorkersStepper';
import { toCalcResult } from './result-utils';
import { ResultDisplay } from './ResultDisplay';

export function ScenarioCard({
  computed,
  selected,
  onSelect,
  onRemove,
  onPatch,
}: {
  computed: ScenarioComputed;
  selected: boolean;
  onSelect: () => void;
  onRemove: (() => void) | null;
  onPatch: (patch: Partial<Omit<CalculatorScenario, 'id' | 'label'>>) => void;
}) {
  const { scenario, workUnit } = computed;
  const scenarioResult = toCalcResult(computed);

  return (
    <div className={`calculator__scenario-card${selected ? ' calculator__scenario-card--selected' : ''}`}>
      <div className="calculator__scenario-card-header">
        <button
          type="button"
          className={`calculator__scenario-select${selected ? ' calculator__scenario-select--active' : ''}`}
          onClick={onSelect}
        >
          {scenario.label}
          {selected ? ' (Selected)' : ''}
        </button>
        {onRemove && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onRemove}
            aria-label={`Remove ${scenario.label}`}
          >
            Remove
          </button>
        )}
      </div>

      <div className="calculator__scenario-body">
        <label className="entry-modal__label">Rate Source</label>
        <div className="task-work-quantity__unit-pills" role="group" aria-label={`${scenario.label} rate source`}>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'template'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'template' })}
          >
            Expected
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'historical'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'historical' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'historical' })}
          >
            Historical
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'manual'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'manual' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'manual' })}
          >
            Manual
          </button>
        </div>

        {scenario.rateMode === 'manual' && (
          <div>
            <label className="entry-modal__label">Manual Rate</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={scenario.manualRate}
                onChange={(e) => onPatch({ manualRate: e.target.value })}
                placeholder="0"
                style={{ width: `${Math.max(String(scenario.manualRate || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">
                {WORK_UNIT_LABELS[workUnit]}/p-hr
              </span>
            </div>
          </div>
        )}

        <label className="entry-modal__label">Solve For</label>
        <div className="task-work-quantity__unit-pills" role="group" aria-label={`${scenario.label} solve for`}>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.solveFor === 'crew'}
            className={`task-work-quantity__unit-pill${scenario.solveFor === 'crew' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ solveFor: 'crew' })}
          >
            Crew
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.solveFor === 'time'}
            className={`task-work-quantity__unit-pill${scenario.solveFor === 'time' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ solveFor: 'time' })}
          >
            Time
          </button>
        </div>

        <label className="entry-modal__label">Work Quantity</label>
        <div className="task-work-quantity__input-wrap">
          <input
            inputMode="decimal"
            className="task-work-quantity__number-input"
            value={scenario.quantity}
            onChange={(e) => onPatch({ quantity: e.target.value })}
            placeholder="0"
            style={{ width: `${Math.max(String(scenario.quantity || '0').length, 1)}ch` }}
          />
          <span className="task-work-quantity__input-unit" aria-hidden="true">
            {WORK_UNIT_LABELS[workUnit]}
          </span>
        </div>

        {scenario.solveFor === 'crew' ? (
          <div>
            <label className="entry-modal__label">Available Time (hours)</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={scenario.timeHours}
                onChange={(e) => onPatch({ timeHours: e.target.value })}
                placeholder="0"
                style={{ width: `${Math.max(String(scenario.timeHours || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">hrs</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="entry-modal__label">Crew Size</label>
            <WorkersStepper value={scenario.crew} onChange={(nextCrew) => onPatch({ crew: nextCrew })} size="compact" />
          </div>
        )}

        <div className="calculator__scenario-result">
          {scenarioResult ? (
            <>
              <ResultDisplay result={scenarioResult} />
              <span className="calculator__scenario-provenance">
                Source: {scenarioResult.rateSource === 'template' ? 'Expected' : scenarioResult.rateSource === 'historical' ? `Historical (${computed.sampleCount ?? 0} tasks)` : 'Manual'}
                {' · '}
                Rate: {formatProductivity(scenarioResult.rateUsed, workUnit as WorkUnit)}
              </span>
              {scenarioResult.confidence != null && scenarioResult.confidence !== 'high' && (
                <span className="calculator__scenario-warning">
                  {scenarioResult.confidence === 'low'
                    ? 'Low confidence historical data'
                    : scenarioResult.confidence === 'medium'
                      ? 'Medium confidence historical data'
                      : ''}
                </span>
              )}
            </>
          ) : (
            <span className="calculator__scenario-invalid">
              {validationReasonLabel(computed.validationReason)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
