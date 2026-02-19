/**
 * CalculatorSheet — productivity calculator for planning.
 * Solves for crew size or time given work quantity and a productivity rate.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  WorkUnit,
  WorkCategory,
  BuildPhase,
  WORK_UNIT_LABELS,
  WORK_CATEGORIES,
  WORK_CATEGORY_LABELS,
  BUILD_PHASES,
  BUILD_PHASE_LABELS,
  TimeEntry,
  Task,
  formatProductivity,
  formatDurationShort,
} from '../lib/types';
import { useTemplateStore } from '../lib/stores/template-store';
import { computeWorkTypeKpis, findKpiByKey, WorkTypeKpi, WorkTypeKey } from '../lib/kpi';
import { getTimeEntriesByTask } from '../lib/db';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

type ProductivitySource = 'template' | 'historical';
type SolveFor = 'crew' | 'time';

interface CalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export function CalculatorSheet({ isOpen, onClose, tasks }: CalculatorSheetProps) {
  const { templates } = useTemplateStore();

  const [workCategory, setWorkCategory] = useState<WorkCategory>('carpet-tiles');
  const [workUnit, setWorkUnit] = useState<WorkUnit>('m2');
  const [buildPhase, setBuildPhase] = useState<BuildPhase | null>(null);
  const [source, setSource] = useState<ProductivitySource>('template');
  const [quantity, setQuantity] = useState('');
  const [solveFor, setSolveFor] = useState<SolveFor>('crew');
  const [timeHours, setTimeHours] = useState('');
  const [crew, setCrew] = useState(2);

  // Load KPIs
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      const qualifying = tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.workCategory != null &&
          t.workUnit != null &&
          t.workQuantity != null &&
          t.workQuantity > 0
      );
      const entriesByTask = new Map<string, TimeEntry[]>();
      for (const task of qualifying) {
        const entries = await getTimeEntriesByTask(task.id);
        entriesByTask.set(task.id, entries);
      }
      if (cancelled) return;
      setKpis(computeWorkTypeKpis(tasks, entriesByTask));
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, tasks]);

  // Resolve productivity rate
  const resolvedRate = useMemo(() => {
    if (source === 'template') {
      // Find matching template
      const match = templates.find(
        (t) =>
          t.workCategory === workCategory &&
          t.workUnit === workUnit &&
          (buildPhase == null || t.buildPhase === buildPhase) &&
          t.targetProductivity != null &&
          t.targetProductivity > 0
      );
      return match?.targetProductivity ?? null;
    } else {
      const key: WorkTypeKey = { workCategory, workUnit, buildPhase };
      const kpi = findKpiByKey(kpis, key);
      // If no exact match with phase, try without phase
      if (!kpi && buildPhase != null) {
        const fallback = findKpiByKey(kpis, { workCategory, workUnit, buildPhase: null });
        return fallback?.avgProductivity ?? null;
      }
      return kpi?.avgProductivity ?? null;
    }
  }, [source, templates, kpis, workCategory, workUnit, buildPhase]);

  // Compute result
  const result = useMemo(() => {
    const qty = parseFloat(quantity);
    if (!resolvedRate || isNaN(qty) || qty <= 0) return null;

    if (solveFor === 'crew') {
      const hours = parseFloat(timeHours);
      if (isNaN(hours) || hours <= 0) return null;
      // crew = work / (time × productivity)
      const crewResult = qty / (hours * resolvedRate);
      return {
        type: 'crew' as const,
        value: Math.ceil(crewResult),
        exact: crewResult,
      };
    } else {
      if (crew <= 0) return null;
      // time = work / (crew × productivity)
      const hours = qty / (crew * resolvedRate);
      const ms = hours * 3_600_000;
      return {
        type: 'time' as const,
        formatted: formatDurationShort(ms),
        hours,
      };
    }
  }, [resolvedRate, quantity, solveFor, timeHours, crew]);

  return (
    <ActionSheet isOpen={isOpen} title="Productivity Calculator" onClose={onClose}>
      <div className="create-task-sheet__form">
        {/* Work Category */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Category</label>
          <select
            className="input"
            value={workCategory}
            onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
          >
            {WORK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{WORK_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Work Unit */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Unit</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Unit">
            {WORK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={workUnit === u}
                className={`task-work-quantity__unit-pill${workUnit === u ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setWorkUnit(u)}
              >
                {WORK_UNIT_LABELS[u]}
              </button>
            ))}
          </div>
        </div>

        {/* Build Phase */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Build Phase</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Build phase">
            <button
              type="button"
              role="radio"
              aria-checked={buildPhase === null}
              className={`task-work-quantity__unit-pill${buildPhase === null ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setBuildPhase(null)}
            >
              Any
            </button>
            {BUILD_PHASES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={buildPhase === p}
                className={`task-work-quantity__unit-pill${buildPhase === p ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setBuildPhase(p)}
              >
                {BUILD_PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Productivity Source */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Productivity Source</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Source">
            <button
              type="button"
              role="radio"
              aria-checked={source === 'template'}
              className={`task-work-quantity__unit-pill${source === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setSource('template')}
            >
              Template Target
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={source === 'historical'}
              className={`task-work-quantity__unit-pill${source === 'historical' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setSource('historical')}
            >
              Historical Avg
            </button>
          </div>
          <div className="calculator__rate">
            {resolvedRate != null
              ? formatProductivity(resolvedRate, workUnit)
              : 'No data'}
          </div>
        </div>

        {/* Work Quantity */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Quantity</label>
          <div className="task-work-quantity__input-wrap">
            <input
              inputMode="decimal"
              className="task-work-quantity__number-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{ width: `${Math.max(String(quantity || '0').length, 1)}ch` }}
            />
            <span className="task-work-quantity__input-unit" aria-hidden="true">
              {WORK_UNIT_LABELS[workUnit]}
            </span>
          </div>
        </div>

        {/* Solve For */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Solve For</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Solve for">
            <button
              type="button"
              role="radio"
              aria-checked={solveFor === 'crew'}
              className={`task-work-quantity__unit-pill${solveFor === 'crew' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setSolveFor('crew')}
            >
              Crew Size
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={solveFor === 'time'}
              className={`task-work-quantity__unit-pill${solveFor === 'time' ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setSolveFor('time')}
            >
              Time
            </button>
          </div>
        </div>

        {/* Known Value */}
        {solveFor === 'crew' ? (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Available Time (hours)</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={timeHours}
                onChange={(e) => setTimeHours(e.target.value)}
                placeholder="0"
                style={{ width: `${Math.max(String(timeHours || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">hrs</span>
            </div>
          </div>
        ) : (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Crew Size</label>
            <WorkersStepper value={crew} onChange={setCrew} size="large" />
          </div>
        )}

        {/* Result */}
        <div className="calculator__result">
          {result == null ? (
            <span className="calculator__result-empty">
              {resolvedRate == null ? 'Select a productivity source with data' : 'Enter values to calculate'}
            </span>
          ) : result.type === 'crew' ? (
            <>
              <span className="calculator__result-value">{result.value}</span>
              <span className="calculator__result-label">
                {result.value === 1 ? 'worker' : 'workers'} needed
              </span>
            </>
          ) : (
            <>
              <span className="calculator__result-value">{result.formatted}</span>
              <span className="calculator__result-label">estimated duration</span>
            </>
          )}
        </div>

        {/* Close */}
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
