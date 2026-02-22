import type { SolveFor } from './calculator';
import { computeProductivityResult } from './calculator';
import type { ConfidenceLevel } from './kpi';
import type { WorkUnit } from './types';

export const MAX_SCENARIOS = 4;

export type ScenarioRateMode = 'template' | 'historical' | 'manual';
export type ScenarioRateSource = 'template' | 'historical' | 'manual';

export type ScenarioValidationReason =
  | 'no_rate'
  | 'insufficient_data'
  | 'bad_inputs'
  | 'missing_quantity'
  | 'missing_time'
  | 'missing_crew'
  | 'invalid_manual_rate';

export interface CalculatorScenario {
  id: string;
  label: string;
  solveFor: SolveFor;
  quantity: string;
  timeHours: string;
  crew: number;
  rateMode: ScenarioRateMode;
  manualRate: string;
}

export interface ScenarioComputeContext {
  workUnit: WorkUnit;
  templateRate: number | null;
  templateName: string | null;
  historicalRate: number | null;
  historicalConfidence: ConfidenceLevel | null;
  historicalSampleCount: number | null;
}

export interface ScenarioComputed {
  scenario: CalculatorScenario;
  workUnit: WorkUnit;
  isValid: boolean;
  validationReason: ScenarioValidationReason | null;
  rateUsed: number | null;
  rateSource: ScenarioRateSource | null;
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
  templateName: string | null;
  quantityUsed: number | null;
  resultType: SolveFor | null;
  crewValue: number | null;
  crewExact: number | null;
  timeHours: number | null;
  estimatedMinutes: number | null;
}

const DEFAULT_LABELS = ['Expected', 'Historical'] as const;
const CUSTOM_LABELS = ['Scenario 3', 'Scenario 4'] as const;

let scenarioCounter = 0;

function nextScenarioId(): string {
  scenarioCounter += 1;
  return `scenario-${scenarioCounter}`;
}

function baseScenario(id: string, label: string, rateMode: ScenarioRateMode): CalculatorScenario {
  return {
    id,
    label,
    solveFor: 'crew',
    quantity: '',
    timeHours: '',
    crew: 2,
    rateMode,
    manualRate: '',
  };
}

export function createDefaultScenarios(): CalculatorScenario[] {
  return [
    baseScenario(nextScenarioId(), DEFAULT_LABELS[0], 'template'),
    baseScenario(nextScenarioId(), DEFAULT_LABELS[1], 'historical'),
  ];
}

export function addScenario(existing: CalculatorScenario[]): CalculatorScenario[] {
  if (existing.length >= MAX_SCENARIOS) return existing;

  const used = new Set(existing.map((scenario) => scenario.label));
  const nextLabel = CUSTOM_LABELS.find((label) => !used.has(label));
  if (!nextLabel) return existing;

  return [...existing, baseScenario(nextScenarioId(), nextLabel, 'template')];
}

export function canRemoveScenario(scenario: CalculatorScenario): boolean {
  return !DEFAULT_LABELS.includes(scenario.label as (typeof DEFAULT_LABELS)[number]);
}

export function removeScenario(existing: CalculatorScenario[], id: string): CalculatorScenario[] {
  const target = existing.find((scenario) => scenario.id === id);
  if (!target || !canRemoveScenario(target)) return existing;
  return existing.filter((scenario) => scenario.id !== id);
}

export function selectScenario(existing: CalculatorScenario[], id: string): string {
  if (existing.some((scenario) => scenario.id === id)) return id;
  return existing[0]?.id ?? '';
}

export function updateScenario(
  existing: CalculatorScenario[],
  id: string,
  patch: Partial<Omit<CalculatorScenario, 'id' | 'label'>>,
): CalculatorScenario[] {
  return existing.map((scenario) => (
    scenario.id === id
      ? { ...scenario, ...patch }
      : scenario
  ));
}

function invalidScenario(
  scenario: CalculatorScenario,
  context: ScenarioComputeContext,
  reason: ScenarioValidationReason,
): ScenarioComputed {
  return {
    scenario,
    workUnit: context.workUnit,
    isValid: false,
    validationReason: reason,
    rateUsed: null,
    rateSource: null,
    confidence: null,
    sampleCount: null,
    templateName: null,
    quantityUsed: null,
    resultType: null,
    crewValue: null,
    crewExact: null,
    timeHours: null,
    estimatedMinutes: null,
  };
}

function resolveRate(
  scenario: CalculatorScenario,
  context: ScenarioComputeContext,
): {
  rateUsed: number;
  rateSource: ScenarioRateSource;
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
  templateName: string | null;
} | ScenarioValidationReason {
  if (scenario.rateMode === 'template') {
    if (context.templateRate == null || context.templateRate <= 0) return 'no_rate';
    return {
      rateUsed: context.templateRate,
      rateSource: 'template',
      confidence: null,
      sampleCount: null,
      templateName: context.templateName,
    };
  }

  if (scenario.rateMode === 'historical') {
    if (context.historicalConfidence === 'insufficient') return 'insufficient_data';
    if (context.historicalRate == null || context.historicalRate <= 0) return 'no_rate';
    return {
      rateUsed: context.historicalRate,
      rateSource: 'historical',
      confidence: context.historicalConfidence,
      sampleCount: context.historicalSampleCount,
      templateName: null,
    };
  }

  const manualRate = parseFloat(scenario.manualRate);
  if (!Number.isFinite(manualRate) || manualRate <= 0) return 'invalid_manual_rate';
  return {
    rateUsed: manualRate,
    rateSource: 'manual',
    confidence: null,
    sampleCount: null,
    templateName: null,
  };
}

export function computeScenario(
  scenario: CalculatorScenario,
  context: ScenarioComputeContext,
): ScenarioComputed {
  const quantityUsed = parseFloat(scenario.quantity);
  if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
    return invalidScenario(scenario, context, 'missing_quantity');
  }

  const resolvedRate = resolveRate(scenario, context);
  if (typeof resolvedRate === 'string') {
    return invalidScenario(scenario, context, resolvedRate);
  }

  const knownTime = parseFloat(scenario.timeHours);
  const knownCrew = scenario.crew;

  if (scenario.solveFor === 'crew' && (!Number.isFinite(knownTime) || knownTime <= 0)) {
    return invalidScenario(scenario, context, 'missing_time');
  }
  if (scenario.solveFor === 'time' && (!Number.isFinite(knownCrew) || knownCrew <= 0)) {
    return invalidScenario(scenario, context, 'missing_crew');
  }

  const raw = computeProductivityResult(
    scenario.solveFor,
    quantityUsed,
    resolvedRate.rateUsed,
    knownTime,
    knownCrew,
  );
  if (!raw) {
    return invalidScenario(scenario, context, 'bad_inputs');
  }

  return {
    scenario,
    workUnit: context.workUnit,
    isValid: true,
    validationReason: null,
    rateUsed: resolvedRate.rateUsed,
    rateSource: resolvedRate.rateSource,
    confidence: resolvedRate.confidence,
    sampleCount: resolvedRate.sampleCount,
    templateName: resolvedRate.templateName,
    quantityUsed,
    resultType: scenario.solveFor,
    crewValue: raw.crew ?? null,
    crewExact: raw.crewExact ?? null,
    timeHours: raw.timeHours ?? null,
    estimatedMinutes: raw.estimatedMinutes ?? null,
  };
}

export function computeAllScenarios(
  scenarios: CalculatorScenario[],
  context: ScenarioComputeContext,
): ScenarioComputed[] {
  return scenarios.map((scenario) => computeScenario(scenario, context));
}

export function validationReasonLabel(reason: ScenarioValidationReason | null): string {
  if (!reason) return '';
  switch (reason) {
    case 'no_rate':
      return 'No rate available for this source.';
    case 'insufficient_data':
      return 'Historical data is insufficient (need 3+ completed tasks).';
    case 'missing_quantity':
      return 'Enter work quantity.';
    case 'missing_time':
      return 'Enter available time in hours.';
    case 'missing_crew':
      return 'Enter a valid crew size.';
    case 'invalid_manual_rate':
      return 'Enter a valid manual productivity rate.';
    default:
      return 'Inputs are invalid for this scenario.';
  }
}

export function __resetScenarioIdsForTest(): void {
  scenarioCounter = 0;
}
