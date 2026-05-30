import type { Plan } from '../planning/plan-model';
import {
  normalizeDailyEffortMap,
  recomputeScheduledSpanFromEffortMap,
} from '../planning/plan-model';
import {
  generateDefaultWorkCalendarForSpans,
  reconcileWorkCalendarForSpans,
} from '../planning/scheduling/work-calendar';
import { dayAccessHours, listDateRange } from '../planning/scheduling/work-calendar';
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

  if (raw.lastExecutionReturnExportedAt === undefined) {
    raw.lastExecutionReturnExportedAt = null;
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

  if (raw.assemblyStartDate === undefined) {
    raw.assemblyStartDate = null;
  }

  if (raw.assemblyEndDate === undefined) {
    raw.assemblyEndDate = null;
  }

  if (raw.dismantleStartDate === undefined) {
    raw.dismantleStartDate = null;
  }

  if (raw.dismantleEndDate === undefined) {
    raw.dismantleEndDate = null;
  }

  if (raw.defaultCrewSize === undefined) {
    raw.defaultCrewSize = null;
  }

  if (raw.defaultEfficiency === undefined) {
    raw.defaultEfficiency = null;
  }

  if (Array.isArray(raw.workCalendar)) {
    for (const day of raw.workCalendar as Array<Record<string, unknown>>) {
      if (day['efficiency'] === undefined) day['efficiency'] = null;
    }
  }

  const phaseSpans = getWorkCalendarPhaseSpans(readPhaseDateValues(raw as unknown as Plan));

  if (!Array.isArray(raw.workCalendar)) {
    raw.workCalendar = generateDefaultWorkCalendarForSpans(
      phaseSpans,
      (raw.defaultCrewSize as number | null) ?? null,
    );
  } else {
    const rawCalendar = raw.workCalendar as unknown as Array<{
      date: string;
      isWorkDay: boolean;
      accessStart: string | null;
      accessEnd: string | null;
      crewSize: number | null;
    }>;
    // Preserve explicitly-enabled extended zone days (moving-in / moving-out) that
    // fall outside commercial phase spans — these are user-authored entries that
    // reconcileWorkCalendarForSpans would otherwise silently discard.
    const spanDates = new Set(phaseSpans.flatMap(s => listDateRange(s.start, s.end)));
    const extendedWorkDays = rawCalendar.filter(d => d.isWorkDay && !spanDates.has(d.date));
    const reconciled = reconcileWorkCalendarForSpans(
      rawCalendar,
      phaseSpans,
      (raw.defaultCrewSize as number | null) ?? null,
    );
    if (extendedWorkDays.length > 0) {
      const reconciledDates = new Set(reconciled.map(d => d.date));
      const merged = [
        ...reconciled,
        ...extendedWorkDays.filter(d => !reconciledDates.has(d.date)),
      ].sort((a, b) => a.date.localeCompare(b.date));
      raw.workCalendar = merged;
    } else {
      raw.workCalendar = reconciled;
    }
  }

  if (Array.isArray(raw.lineItems)) {
    const workCalendar = raw.workCalendar as Array<{
      date: string;
      isWorkDay: boolean;
      accessStart: string | null;
      accessEnd: string | null;
      crewSize: number | null;
    }>;
    const dayByDate = new Map(workCalendar.map((day) => [day.date, day]));
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

      for (const prefix of ['assembly', 'dismantle'] as const) {
        const personHoursKey = `${prefix}PersonHoursByDate`;
        const crewByDateKey = `${prefix}CrewByDate`;
        const scheduledStartKey = `${prefix}ScheduledStart`;
        const scheduledEndKey = `${prefix}ScheduledEnd`;
        if (lineItem[personHoursKey] === undefined) {
          const existing = lineItem[crewByDateKey] as Record<string, number> | undefined;
          const start = lineItem[scheduledStartKey] as string | null | undefined;
          const end = lineItem[scheduledEndKey] as string | null | undefined;
          const rate = Number(lineItem[`${prefix}Rate`] ?? 0);
          const crew = Number(lineItem[`${prefix}Crew`] ?? 0);
          const timeHours = Number(lineItem[`${prefix}TimeHours`] ?? 0);
          const quantity = prefix === 'dismantle'
            ? Number(lineItem.dismantleQuantity ?? lineItem.workQuantity ?? 0)
            : Number(lineItem.workQuantity ?? 0);
          const requiredPH = timeHours > 0 && crew > 0
            ? timeHours * crew
            : rate > 0 && quantity > 0
              ? quantity / rate
              : null;
          const dates = start && end ? listDateRange(start, end) : [];
          let remaining = requiredPH ?? 0;
          const migrated: Record<string, number> = {};
          for (const date of dates) {
            const day = dayByDate.get(date);
            if (day && !day.isWorkDay) continue;
            const accessHours = day ? dayAccessHours(day) : 8;
            const legacyCrew = existing?.[date] ?? crew;
            const dayCap = Math.max(0, legacyCrew * accessHours);
            if (requiredPH == null || requiredPH <= 0) continue;
            const assigned = Math.min(remaining, dayCap);
            if (assigned > 0) {
              migrated[date] = Number(assigned.toFixed(2));
              remaining -= assigned;
            }
            if (remaining <= 0.01) break;
          }
          const normalized = normalizeDailyEffortMap(migrated);
          lineItem[personHoursKey] = normalized;
          const span = recomputeScheduledSpanFromEffortMap(normalized);
          lineItem[scheduledStartKey] = span.scheduledStart;
          lineItem[scheduledEndKey] = span.scheduledEnd;
          delete lineItem[crewByDateKey];
        }
      }
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
