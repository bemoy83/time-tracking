/**
 * CalculatorSheet — advisory productivity calculator for planning.
 * Solves for crew size or time given work quantity and a productivity rate.
 *
 * Uses WorkType selector for expected rate. Historical rate from KPIs.
 */

import {
  type Task,
  formatProductivity,
  formatWorkTypeWithUnit,
  resolveWorkUnitLabel,
} from '../lib/types';
import { type OutlierHandlingMode } from '../lib/kpi';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';
import { CompareCard } from './calculator/CompareCard';
import { ProvenanceDisplay } from './calculator/ProvenanceDisplay';
import { ResultDisplay } from './calculator/ResultDisplay';
import { useCalculatorSheetModel } from './calculator/useCalculatorSheetModel';

interface CalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  outlierMode: OutlierHandlingMode;
}

export function CalculatorSheet({ isOpen, onClose, tasks, outlierMode }: CalculatorSheetProps) {
  const model = useCalculatorSheetModel({ isOpen, tasks, outlierMode });

  return (
    <ActionSheet isOpen={isOpen} title="Productivity Calculator" onClose={onClose}>
      <div className="create-task-sheet__form">
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Type</label>
          {model.workTypes.length === 0 ? (
            <p className="settings-view__empty">No work types defined.</p>
          ) : (
            <select
              className="input"
              value={model.selectedWorkTypeId}
              onChange={(e) => model.setSelectedWorkTypeId(e.target.value)}
            >
              {model.workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {formatWorkTypeWithUnit(wt.title, wt.workUnit)}
                </option>
              ))}
            </select>
          )}
        </div>

        <>
            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Productivity Source</label>
              <div className="task-work-quantity__unit-pills" role="group" aria-label="Source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={model.source === 'template'}
                  className={`task-work-quantity__unit-pill${model.source === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => model.setSource('template')}
                >
                  Expected Rate
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={model.source === 'historical'}
                  className={`task-work-quantity__unit-pill${model.source === 'historical' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => model.setSource('historical')}
                >
                  Historical Avg
                </button>
              </div>
              <div className="calculator__rate">
                {model.resolvedRate != null
                  ? formatProductivity(model.resolvedRate, model.workUnit)
                  : 'No data'}
                {model.activeRate?.confidence != null && (
                  <span className={`kpi-badge kpi-badge--${model.activeRate.confidence}`} style={{ marginLeft: 8 }}>
                    {model.activeRate.confidence === 'insufficient'
                      ? 'Insufficient data'
                      : `${model.activeRate.confidence} · ${model.activeRate.sampleCount} tasks`}
                  </span>
                )}
              </div>
            </div>

            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Work Quantity</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={model.quantity}
                  onChange={(e) => model.setQuantity(e.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(model.quantity || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden="true">
                  {resolveWorkUnitLabel(model.workUnit)}
                </span>
              </div>
            </div>

            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Solve For</label>
              <div className="task-work-quantity__unit-pills" role="group" aria-label="Solve for">
                <button
                  type="button"
                  role="radio"
                  aria-checked={model.solveFor === 'crew'}
                  className={`task-work-quantity__unit-pill${model.solveFor === 'crew' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => model.setSolveFor('crew')}
                >
                  Crew Size
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={model.solveFor === 'time'}
                  className={`task-work-quantity__unit-pill${model.solveFor === 'time' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => model.setSolveFor('time')}
                >
                  Time
                </button>
              </div>
            </div>

            {model.solveFor === 'crew' ? (
              <div className="create-task-sheet__section">
                <label className="entry-modal__label">Available Time (hours)</label>
                <div className="task-work-quantity__input-wrap">
                  <input
                    inputMode="decimal"
                    className="task-work-quantity__number-input"
                    value={model.timeHours}
                    onChange={(e) => model.setTimeHours(e.target.value)}
                    placeholder="0"
                    style={{ width: `${Math.max(String(model.timeHours || '0').length, 1)}ch` }}
                  />
                  <span className="task-work-quantity__input-unit" aria-hidden="true">hrs</span>
                </div>
              </div>
            ) : (
              <div className="create-task-sheet__section">
                <label className="entry-modal__label">Crew Size</label>
                <WorkersStepper value={model.crew} onChange={model.setCrew} size="large" />
              </div>
            )}

            <div className="calculator__result">
              {model.result == null ? (
                <span className="calculator__result-empty">
                  {model.resolvedRate == null
                    ? 'Select a work type with data'
                    : model.isInsufficient
                      ? 'Insufficient data — need 3+ completed tasks for this work type'
                      : 'Enter values to calculate'}
                </span>
              ) : (
                <>
                  <ResultDisplay result={model.result} />
                  <ProvenanceDisplay result={model.result} activeRate={model.activeRate!} workUnit={model.workUnit} />
                </>
              )}
            </div>

            {model.hasBothSources && model.result != null && model.altResult != null && (
              <div className="calculator__compare">
                <span className="calculator__compare-label">Compare sources</span>
                <div className="calculator__compare-grid">
                  <CompareCard
                    label={model.source === 'template' ? 'Expected Rate' : 'Historical Avg'}
                    rate={model.activeRate!}
                    result={model.result}
                    workUnit={model.workUnit}
                    isActive
                  />
                  <CompareCard
                    label={model.source === 'template' ? 'Historical Avg' : 'Expected Rate'}
                    rate={model.altRate!}
                    result={model.altResult}
                    workUnit={model.workUnit}
                    isActive={false}
                  />
                </div>
              </div>
            )}
        </>

        {model.result != null && (model.eligibleTasks.length > 0 || model.eligibleTemplates.length > 0) && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Apply to Task or Template</label>
            <div className="calculator__save-row">
              <select
                className="input calculator__save-select"
                value={model.saveTargetId}
                onChange={(e) => model.handleSaveTargetChange(e.target.value)}
              >
                <option value="">Select target...</option>
                {model.eligibleTasks.length > 0 && (
                  <optgroup label="Tasks">
                    {model.eligibleTasks.map((task) => (
                      <option key={task.id} value={`task:${task.id}`}>{task.title}</option>
                    ))}
                  </optgroup>
                )}
                {model.eligibleTemplates.length > 0 && (
                  <optgroup label="Templates">
                    {model.eligibleTemplates.map((template) => (
                      <option key={template.id} value={`template:${template.id}`}>{template.title}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={model.isSaveDisabled}
                onClick={() => { void model.handleSave(); }}
              >
                {model.saveStatus === 'saved' ? 'Saved' : model.saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
