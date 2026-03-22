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
    expect(plan.lastExecutionReturnExportedAt).toBeNull();
  });

  it('normalizes reviewedAt plans to reviewed status', () => {
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
    expect(plan.status).toBe('reviewed');
    expect(plan.activatedAt).toBe('2024-02-01T00:00:00.000Z');
    expect(plan.reviewedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('adds scheduling defaults for legacy plans', () => {
    const raw: Record<string, unknown> = {
      id: 'plan-6',
      status: 'draft',
      title: 'Legacy schedule',
      lineItems: [
        {
          id: 'li-1',
          title: 'Install',
          workTypeTitle: 'Carpet',
          workUnit: 'm2',
          phase: 'assembly',
          workTypeId: null,
          workQuantity: 10,
          crew: 1,
          timeHours: 2,
          productivityRate: 5,
          rateSource: 'manual',
          rationale: null,
          reviewNote: null,
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const plan = normalizePlan(raw);
    expect(plan.eventStartDate).toBeNull();
    expect(plan.eventEndDate).toBeNull();
    expect(plan.assemblyStartDate).toBeNull();
    expect(plan.assemblyEndDate).toBeNull();
    expect(plan.dismantleStartDate).toBeNull();
    expect(plan.dismantleEndDate).toBeNull();
    expect(plan.defaultCrewSize).toBeNull();
    expect(Array.isArray(plan.workCalendar)).toBe(true);
    // normalizePlan sets legacy fields on raw line item objects
    const li = plan.lineItems[0] as unknown as Record<string, unknown>;
    expect(li.originalScheduledStart).toBeNull();
    expect(li.amendmentNote).toBeNull();
  });
});
