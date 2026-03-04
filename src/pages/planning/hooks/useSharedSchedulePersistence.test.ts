import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlan, type Plan } from '../../../lib/planning/plan-model';
import { createSharedSchedulePersistenceController } from './useSharedSchedulePersistence';

function makePlan(id: string, updatedAt = '2026-03-01T00:00:00.000Z'): Plan {
  const plan = createPlan(id);
  return {
    ...plan,
    id,
    title: id,
    updatedAt,
    createdAt: updatedAt,
  };
}

describe('useSharedSchedulePersistence controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces by plan id using independent timers', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void>();
    const p1 = makePlan('p1', 't0');
    const p2 = makePlan('p2', 't0');

    const controller = createSharedSchedulePersistenceController({
      plansById: new Map([
        [p1.id, p1],
        [p2.id, p2],
      ]),
      autosaveDelay: 500,
      getOnSavePlan: () => saveSpy,
    });

    controller.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    vi.advanceTimersByTime(200);
    controller.applyPlanMutation('p2', (plan) => ({ ...plan, updatedAt: 't2' }));

    vi.advanceTimersByTime(299);
    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].id).toBe('p1');

    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy.mock.calls[1][0].id).toBe('p2');
  });

  it('keeps only latest pending mutation per plan', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void>();
    const p1 = makePlan('p1', 't0');

    const controller = createSharedSchedulePersistenceController({
      plansById: new Map([[p1.id, p1]]),
      autosaveDelay: 500,
      getOnSavePlan: () => saveSpy,
    });

    controller.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    vi.advanceTimersByTime(300);
    controller.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't2' }));

    vi.advanceTimersByTime(499);
    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].updatedAt).toBe('t2');
  });

  it('flushes pending updates on dispose (unmount)', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void>();
    const p1 = makePlan('p1', 't0');

    const controller = createSharedSchedulePersistenceController({
      plansById: new Map([[p1.id, p1]]),
      autosaveDelay: 500,
      getOnSavePlan: () => saveSpy,
    });

    controller.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    await controller.dispose();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].updatedAt).toBe('t1');
  });

  it('does not save when mutation leaves plan unchanged', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void>();
    const p1 = makePlan('p1', 't0');

    const controller = createSharedSchedulePersistenceController({
      plansById: new Map([[p1.id, p1]]),
      autosaveDelay: 500,
      getOnSavePlan: () => saveSpy,
    });

    const changed = controller.applyPlanMutation('p1', (plan) => plan);
    expect(changed).toBe(false);

    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(saveSpy).not.toHaveBeenCalled();
  });
});
