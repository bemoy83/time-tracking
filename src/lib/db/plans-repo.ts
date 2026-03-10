import type { Plan } from '../planning/plan-model';
import {
  generateDefaultWorkCalendarForSpans,
  reconcileWorkCalendarForSpans,
} from '../planning/scheduling/work-calendar';
import { getWorkCalendarPhaseSpans, readPhaseDateValues } from '../planning/scheduling/schedule-span';
import { getDB } from './core';

/**
 * Normalize a plan read from DB for forward-compatibility.
 * Legacy records may have status 'locked' / field 'lockedAt';
 * the canonical model now uses 'active' / 'activatedAt'.
 * This shim lets both old and new records coexist safely.
 */
export function normalizePlan(raw: Record<string, unknown>): Plan {
  // Map legacy 'locked' → 'active'
  if (raw.status === 'locked') {
    raw.status = 'active';
  }

  // Map legacy 'lockedAt' → 'activatedAt' if the new field is absent
  if (raw.lockedAt !== undefined && raw.activatedAt === undefined) {
    raw.activatedAt = raw.lockedAt;
  }

  if (raw.activatedAt === undefined) {
    raw.activatedAt = null;
  }

  if (raw.importedAt === undefined) {
    raw.importedAt = null;
  }

  if (raw.sessionClosedAt === undefined) {
    raw.sessionClosedAt = null;
  }

  if (raw.reviewedAt != null && raw.status !== 'reviewed' && raw.status !== 'session-closed') {
    raw.status = 'reviewed';
  }

  if (raw.eventStartDate === undefined) {
    raw.eventStartDate = null;
  }

  if (raw.eventEndDate === undefined) {
    raw.eventEndDate = null;
  }

  if (raw.buildUpStartDate === undefined) {
    raw.buildUpStartDate = null;
  }

  if (raw.buildUpEndDate === undefined) {
    raw.buildUpEndDate = null;
  }

  if (raw.tearDownStartDate === undefined) {
    raw.tearDownStartDate = null;
  }

  if (raw.tearDownEndDate === undefined) {
    raw.tearDownEndDate = null;
  }

  if (raw.defaultCrewSize === undefined) {
    raw.defaultCrewSize = null;
  }

  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(raw as unknown as Plan));

  if (!Array.isArray(raw.workCalendar)) {
    raw.workCalendar = generateDefaultWorkCalendarForSpans(
      phaseSpans,
      (raw.defaultCrewSize as number | null) ?? null,
    );
  } else {
    raw.workCalendar = reconcileWorkCalendarForSpans(
      raw.workCalendar as unknown as Array<{
        date: string;
        isWorkDay: boolean;
        accessStart: string | null;
        accessEnd: string | null;
        crewSize: number | null;
      }>,
      phaseSpans,
      (raw.defaultCrewSize as number | null) ?? null,
    );
  }

  if (Array.isArray(raw.lineItems)) {
    for (const lineItem of raw.lineItems as Array<Record<string, unknown>>) {
      if (lineItem.executionStatus === undefined) lineItem.executionStatus = 'pending';
      if (lineItem.blockReason === undefined) lineItem.blockReason = null;
      if (lineItem.blockCategory === undefined) lineItem.blockCategory = null;
      if (lineItem.executorNote === undefined) lineItem.executorNote = null;
      if (lineItem.deferredNote === undefined) lineItem.deferredNote = null;
      if (lineItem.removedFromSource === undefined) lineItem.removedFromSource = false;
      if (lineItem.scheduledStart === undefined) lineItem.scheduledStart = null;
      if (lineItem.scheduledEnd === undefined) lineItem.scheduledEnd = null;
      if (lineItem.originalScheduledStart === undefined) lineItem.originalScheduledStart = null;
      if (lineItem.originalScheduledEnd === undefined) lineItem.originalScheduledEnd = null;
      if (lineItem.amendmentNote === undefined) lineItem.amendmentNote = null;
      if (lineItem.amendedAt === undefined) lineItem.amendedAt = null;
    }
  }

  return raw as unknown as Plan;
}

export async function addPlan(plan: Plan): Promise<void> {
  const db = await getDB();
  await db.add('plans', plan);
}

export async function getPlan(id: string): Promise<Plan | null> {
  const db = await getDB();
  const raw = await db.get('plans', id);
  if (!raw) return null;
  return normalizePlan(raw as unknown as Record<string, unknown>);
}

export async function getAllPlans(): Promise<Plan[]> {
  const db = await getDB();
  const raws = await db.getAll('plans');
  return raws.map((r) => normalizePlan(r as unknown as Record<string, unknown>));
}

export async function updatePlan(plan: Plan): Promise<void> {
  const db = await getDB();
  await db.put('plans', plan);
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('plans', id);
}

/**
 * Delete all plans (workspace and field plans).
 */
export async function deleteAllPlans(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('plans', 'readwrite');
  await tx.store.clear();
  await tx.done;
}
