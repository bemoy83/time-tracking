/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createPlan, type Plan } from '../../../lib/planning/plan-model';
import { useSharedSchedulePersistence } from './useSharedSchedulePersistence';

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

describe('useSharedSchedulePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces by plan id using independent timers', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void | Promise<void>>();
    const p1 = makePlan('p1', 't0');
    const p2 = makePlan('p2', 't0');
    const plansById = new Map([
      [p1.id, p1],
      [p2.id, p2],
    ]);

    const { result } = renderHook(() =>
      useSharedSchedulePersistence({
        plansById,
        onSavePlan: saveSpy,
        autosaveDelay: 500,
      }),
    );

    act(() => {
      result.current.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    });
    vi.advanceTimersByTime(200);
    act(() => {
      result.current.applyPlanMutation('p2', (plan) => ({ ...plan, updatedAt: 't2' }));
    });

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
    const saveSpy = vi.fn<(plan: Plan) => void | Promise<void>>();
    const p1 = makePlan('p1', 't0');
    const plansById = new Map([[p1.id, p1]]);

    const { result } = renderHook(() =>
      useSharedSchedulePersistence({
        plansById,
        onSavePlan: saveSpy,
        autosaveDelay: 500,
      }),
    );

    act(() => {
      result.current.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    });
    vi.advanceTimersByTime(300);
    act(() => {
      result.current.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't2' }));
    });

    vi.advanceTimersByTime(499);
    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].updatedAt).toBe('t2');
  });

  it('flushes pending updates on unmount', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void | Promise<void>>();
    const p1 = makePlan('p1', 't0');
    const plansById = new Map([[p1.id, p1]]);

    const { result, unmount } = renderHook(() =>
      useSharedSchedulePersistence({
        plansById,
        onSavePlan: saveSpy,
        autosaveDelay: 500,
      }),
    );

    act(() => {
      result.current.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    });
    unmount();
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].updatedAt).toBe('t1');
  });

  it('does not save when mutation leaves plan unchanged', async () => {
    const saveSpy = vi.fn<(plan: Plan) => void | Promise<void>>();
    const p1 = makePlan('p1', 't0');
    const plansById = new Map([[p1.id, p1]]);

    const { result } = renderHook(() =>
      useSharedSchedulePersistence({
        plansById,
        onSavePlan: saveSpy,
        autosaveDelay: 500,
      }),
    );

    let changed: boolean;
    act(() => {
      changed = result.current.applyPlanMutation('p1', (plan) => plan);
    });
    expect(changed!).toBe(false);

    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('returns optimistic plan in effectivePlansById immediately after mutate', () => {
    const saveSpy = vi.fn<(plan: Plan) => void | Promise<void>>();
    const p1 = makePlan('p1', 't0');
    const plansById = new Map([[p1.id, p1]]);

    const { result } = renderHook(() =>
      useSharedSchedulePersistence({
        plansById,
        onSavePlan: saveSpy,
        autosaveDelay: 500,
      }),
    );

    act(() => {
      result.current.applyPlanMutation('p1', (plan) => ({ ...plan, updatedAt: 't1' }));
    });

    const effective = result.current.effectivePlansById.get('p1');
    expect(effective?.updatedAt).toBe('t1');
  });
});
