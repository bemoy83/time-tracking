/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import { ScheduleGridHeader } from './ScheduleGridHeader';

function makeDay(overrides: Partial<WorkCalendarDay> = {}): WorkCalendarDay {
  return {
    date: '2026-03-24',
    isWorkDay: true,
    accessStart: '08:00',
    accessEnd: '16:00',
    crewSize: 2,
    ...overrides,
  };
}

function makeCapacity(overrides: Partial<DailyCapacity> = {}): DailyCapacity {
  return {
    date: '2026-03-24',
    isWorkDay: true,
    requiredPersonHours: 12,
    availablePersonHours: 16,
    rawAvailablePersonHours: 20,
    effectiveAvailablePersonHours: 16,
    accessHours: 8,
    availableCrew: 2,
    effectiveAvailableCrew: 1.6,
    assignedCrewTotal: 1.5,
    utilization: 0.75,
    lineItemCount: 5,
    assignedRowCount: 5,
    smallAllocationCount: 2,
    allocatedPersonHours: 12,
    averageAllocationPersonHours: 2.4,
    largestAllocationShare: 0.33,
    fragmentationScore: 3,
    fragmentationRisk: 'moderate',
    isOverAllocated: false,
    isOverAssignedCrew: false,
    isOverWorkerCapacity: false,
    assignedCapacityPersonHours: 12,
    isCompletionDay: false,
    needToMeetTargetPersonHours: 0,
    shortfallPersonHours: 0,
    isOverStaffed: false,
    ...overrides,
  };
}

describe('ScheduleGridHeader', () => {
  it('adds an advisory fragmentation class and tooltip details for surfaced days', () => {
    const { container } = render(
      <ScheduleGridHeader
        calendar={[makeDay()]}
        dayByDate={new Map([[ '2026-03-24', makeCapacity() ]])}
        gridColumns="220px 144px"
        label="Schedule"
      />,
    );

    const dayCol = container.querySelector('.schedule-grid__day-col');
    expect(dayCol?.className).toContain('schedule-grid__day-col--fragmented');
    expect(dayCol?.getAttribute('title')).toContain('Fragmentation: moderate');
    expect(dayCol?.getAttribute('title')).toContain('5 assigned rows');
  });
});
