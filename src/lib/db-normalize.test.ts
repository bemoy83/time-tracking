import { describe, expect, it } from 'vitest';
import { normalizePlan } from './db';

describe('normalizePlan', () => {
  it('maps legacy locked status to active', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-1',
      status: 'locked',
      lockedAt: '2024-06-01T00:00:00.000Z',
      title: 'Test',
      lineItems: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const plan = normalizePlan(raw);
    expect(plan.status).toBe('active');
    expect(plan.activatedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('maps lockedAt to activatedAt when activatedAt is absent', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-2',
      status: 'active',
      lockedAt: '2024-03-01T00:00:00.000Z',
      title: 'Already migrated status',
      lineItems: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const plan = normalizePlan(raw);
    expect(plan.activatedAt).toBe('2024-03-01T00:00:00.000Z');
  });

  it('preserves activatedAt when already present', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-3',
      status: 'active',
      activatedAt: '2024-05-01T00:00:00.000Z',
      title: 'New format',
      lineItems: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const plan = normalizePlan(raw);
    expect(plan.status).toBe('active');
    expect(plan.activatedAt).toBe('2024-05-01T00:00:00.000Z');
  });

  it('leaves draft plans unchanged', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-4',
      status: 'draft',
      activatedAt: null,
      title: 'Draft',
      lineItems: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const plan = normalizePlan(raw);
    expect(plan.status).toBe('draft');
    expect(plan.activatedAt).toBeNull();
  });

  it('leaves reviewed plans unchanged', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-5',
      status: 'active',
      activatedAt: '2024-02-01T00:00:00.000Z',
      reviewedAt: '2024-06-01T00:00:00.000Z',
      title: 'Reviewed',
      lineItems: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const plan = normalizePlan(raw);
    expect(plan.status).toBe('active');
    expect(plan.activatedAt).toBe('2024-02-01T00:00:00.000Z');
    expect(plan.reviewedAt).toBe('2024-06-01T00:00:00.000Z');
  });
});
