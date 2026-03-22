import { describe, expect, it } from 'vitest';
import type { CapacitySummary, DailyCapacity } from '../../../lib/planning/scheduling/capacity';
import type { ConflictSuggestions } from '../../../lib/planning/scheduling/conflict-resolution';
import { buildScheduleViewIssues } from './schedule-view-issues';

function makeDay(overrides: Partial<DailyCapacity> = {}): DailyCapacity {
  return {
    date: '2026-03-24',
    isWorkDay: true,
    requiredPersonHours: 8,
    rawAvailablePersonHours: 20,
    effectiveAvailablePersonHours: 16,
    accessHours: 8,
    availableCrew: 2,
    effectiveAvailableCrew: 1.6,
    assignedCrewTotal: 1,
    utilization: 0.5,
    lineItemCount: 1,
    assignedRowCount: 1,
    smallAllocationCount: 0,
    allocatedPersonHours: 8,
    averageAllocationPersonHours: 8,
    largestAllocationShare: 1,
    fragmentationScore: 0,
    fragmentationRisk: 'none',
    fragmentationFactor: 1,
    skillGroupCount: 1,
    isOverAllocated: false,
    isOverAssignedCrew: false,
    isOverWorkerCapacity: false,
    assignedCapacityPersonHours: 8,
    isCompletionDay: false,
    needToMeetTargetPersonHours: 0,
    shortfallPersonHours: 0,
    isOverStaffed: false,
    ...overrides,
  };
}

function makeCapacitySummary(overrides: Partial<CapacitySummary> = {}): CapacitySummary {
  return {
    days: [makeDay()],
    totalRequiredPersonHours: 8,
    totalRawAvailablePersonHours: 20,
    totalEffectiveAvailablePersonHours: 16,
    headroomPersonHours: 8,
    overAllocatedDayCount: 0,
    overAssignedCrewDayCount: 0,
    overWorkerCapacityDayCount: 0,
    unscheduledLineItemCount: 0,
    scheduledLineItemCount: 1,
    overStaffedDayCount: 0,
    overStaffedWarningDayCount: 0,
    fragmentedDayCount: 0,
    highFragmentationDayCount: 0,
    ...overrides,
  };
}

function makeConflictSuggestions(): ConflictSuggestions {
  return {
    crewSuggestions: [],
    overtimeSuggestions: [],
    workerCapacitySuggestions: [],
    hasConflicts: false,
  };
}

describe('buildScheduleViewIssues', () => {
  it('creates fragmentation planning and panel warnings for the highest-risk day', () => {
    const capacity = makeCapacitySummary({
      days: [
        makeDay({
          date: '2026-03-24',
          assignedRowCount: 5,
          smallAllocationCount: 2,
          allocatedPersonHours: 12,
          averageAllocationPersonHours: 2.4,
          largestAllocationShare: 0.33,
          fragmentationScore: 3,
          fragmentationRisk: 'moderate',
        }),
        makeDay({
          date: '2026-03-25',
          assignedRowCount: 8,
          smallAllocationCount: 4,
          allocatedPersonHours: 8,
          averageAllocationPersonHours: 1,
          largestAllocationShare: 0.13,
          fragmentationScore: 6,
          fragmentationRisk: 'high',
        }),
      ],
      fragmentedDayCount: 2,
      highFragmentationDayCount: 1,
    });

    const result = buildScheduleViewIssues({
      capacity,
      conflictSuggestions: makeConflictSuggestions(),
      schedulableUnscheduledCount: 0,
      assistantReportStale: false,
      assistantUnresolvedCount: 0,
      assistantReviewIssues: [],
    });

    expect(result.planningIssues.some((issue) => issue.id === 'fragmentation' && issue.label.includes('2 days show'))).toBe(true);

    const panelIssue = result.panelIssues.find((issue) => issue.kind === 'fragmentation');
    expect(panelIssue).toBeTruthy();
    expect(panelIssue?.category).toBe('optimization');
    expect(panelIssue?.detail).toContain('Mar 25');
    expect(panelIssue?.facts?.[0]).toContain('8 assigned rows');
  });
});
