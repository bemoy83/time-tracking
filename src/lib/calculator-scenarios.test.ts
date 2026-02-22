import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetScenarioIdsForTest,
  addScenario,
  computeAllScenarios,
  computeScenario,
  createDefaultScenarios,
  removeScenario,
  selectScenario,
  updateScenario,
  type CalculatorScenario,
  type ScenarioComputeContext,
} from './calculator-scenarios';

const baseContext: ScenarioComputeContext = {
  workUnit: 'm2',
  templateRate: 10,
  templateName: 'Drywall',
  historicalRate: 8,
  historicalConfidence: 'high',
  historicalSampleCount: 12,
};

function withPatch(
  scenario: CalculatorScenario,
  patch: Partial<Omit<CalculatorScenario, 'id' | 'label'>>,
): CalculatorScenario {
  return { ...scenario, ...patch };
}

describe('calculator-scenarios', () => {
  beforeEach(() => {
    __resetScenarioIdsForTest();
  });

  it('seeds expected and historical defaults', () => {
    const scenarios = createDefaultScenarios();
    expect(scenarios).toHaveLength(2);
    expect(scenarios.map((scenario) => scenario.label)).toEqual(['Expected', 'Historical']);
    expect(scenarios[0].rateMode).toBe('template');
    expect(scenarios[1].rateMode).toBe('historical');
    expect(scenarios[0].solveFor).toBe('crew');
    expect(scenarios[0].crew).toBe(2);
  });

  it('adds scenarios up to max of 4', () => {
    const defaults = createDefaultScenarios();
    const withThird = addScenario(defaults);
    expect(withThird).toHaveLength(3);
    expect(withThird[2].label).toBe('Scenario 3');

    const withFourth = addScenario(withThird);
    expect(withFourth).toHaveLength(4);
    expect(withFourth[3].label).toBe('Scenario 4');

    const unchanged = addScenario(withFourth);
    expect(unchanged).toHaveLength(4);
  });

  it('removes only custom scenarios and keeps defaults', () => {
    const defaults = createDefaultScenarios();
    const withCustom = addScenario(defaults);
    const expectedId = withCustom[0].id;
    const customId = withCustom[2].id;

    const blocked = removeScenario(withCustom, expectedId);
    expect(blocked).toHaveLength(3);

    const removed = removeScenario(withCustom, customId);
    expect(removed).toHaveLength(2);
    expect(removed.map((scenario) => scenario.label)).toEqual(['Expected', 'Historical']);
  });

  it('selects requested scenario when present, otherwise first', () => {
    const scenarios = createDefaultScenarios();
    expect(selectScenario(scenarios, scenarios[1].id)).toBe(scenarios[1].id);
    expect(selectScenario(scenarios, 'missing')).toBe(scenarios[0].id);
  });

  it('updates one scenario by id', () => {
    const scenarios = createDefaultScenarios();
    const updated = updateScenario(scenarios, scenarios[0].id, {
      solveFor: 'time',
      quantity: '120',
      crew: 3,
      rateMode: 'manual',
      manualRate: '7',
    });
    expect(updated[0].solveFor).toBe('time');
    expect(updated[0].quantity).toBe('120');
    expect(updated[0].crew).toBe(3);
    expect(updated[0].rateMode).toBe('manual');
    expect(updated[0].manualRate).toBe('7');
  });

  it('computes crew from template and time from historical', () => {
    const defaults = createDefaultScenarios();
    const expectedScenario = withPatch(defaults[0], {
      solveFor: 'crew',
      quantity: '100',
      timeHours: '5',
      rateMode: 'template',
    });
    const historicalScenario = withPatch(defaults[1], {
      solveFor: 'time',
      quantity: '96',
      crew: 3,
      rateMode: 'historical',
    });

    const expectedResult = computeScenario(expectedScenario, baseContext);
    expect(expectedResult.isValid).toBe(true);
    expect(expectedResult.crewValue).toBe(2);
    expect(expectedResult.rateSource).toBe('template');

    const historicalResult = computeScenario(historicalScenario, baseContext);
    expect(historicalResult.isValid).toBe(true);
    expect(historicalResult.estimatedMinutes).toBe(240);
    expect(historicalResult.rateSource).toBe('historical');
  });

  it('computes with manual rate mode', () => {
    const scenario = withPatch(createDefaultScenarios()[0], {
      solveFor: 'time',
      quantity: '120',
      crew: 2,
      rateMode: 'manual',
      manualRate: '6',
    });
    const result = computeScenario(scenario, baseContext);
    expect(result.isValid).toBe(true);
    expect(result.rateSource).toBe('manual');
    expect(result.estimatedMinutes).toBe(600);
  });

  it('returns invalid reasons for missing or insufficient inputs/rates', () => {
    const defaults = createDefaultScenarios();

    const missingQty = computeScenario(defaults[0], baseContext);
    expect(missingQty.isValid).toBe(false);
    expect(missingQty.validationReason).toBe('missing_quantity');

    const missingTime = computeScenario(
      withPatch(defaults[0], { quantity: '100', solveFor: 'crew', timeHours: '' }),
      baseContext,
    );
    expect(missingTime.validationReason).toBe('missing_time');

    const missingCrew = computeScenario(
      withPatch(defaults[0], { quantity: '100', solveFor: 'time', crew: 0 }),
      baseContext,
    );
    expect(missingCrew.validationReason).toBe('missing_crew');

    const badManual = computeScenario(
      withPatch(defaults[0], { quantity: '100', solveFor: 'time', crew: 2, rateMode: 'manual', manualRate: '0' }),
      baseContext,
    );
    expect(badManual.validationReason).toBe('invalid_manual_rate');

    const noTemplateRate = computeScenario(
      withPatch(defaults[0], { quantity: '100', solveFor: 'time', crew: 2, rateMode: 'template' }),
      { ...baseContext, templateRate: null },
    );
    expect(noTemplateRate.validationReason).toBe('no_rate');

    const insufficientHistorical = computeScenario(
      withPatch(defaults[1], { quantity: '100', solveFor: 'time', crew: 2, rateMode: 'historical' }),
      { ...baseContext, historicalConfidence: 'insufficient' },
    );
    expect(insufficientHistorical.validationReason).toBe('insufficient_data');
  });

  it('computes all scenarios in one pass', () => {
    const defaults = createDefaultScenarios();
    const scenarios = updateScenario(defaults, defaults[0].id, { quantity: '10', timeHours: '1' });
    const all = computeAllScenarios(scenarios, baseContext);
    expect(all).toHaveLength(2);
    expect(all[0].scenario.label).toBe('Expected');
    expect(all[0].isValid).toBe(true);
    expect(all[1].scenario.label).toBe('Historical');
    expect(all[1].isValid).toBe(false);
  });
});
