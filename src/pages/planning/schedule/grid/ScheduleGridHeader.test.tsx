/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import { ScheduleGridHeader } from './ScheduleGridHeader';

afterEach(() => {
  vi.useRealTimers();
});

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
    fragmentationFactor: 1,
    requiredSkillCrew: 0,
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
  it('renders a fragmentation warning icon with a delayed custom tooltip for surfaced days', () => {
    vi.useFakeTimers();

    const { container } = render(
      <ScheduleGridHeader
        calendar={[makeDay()]}
        dayByDate={new Map([[ '2026-03-24', makeCapacity() ]])}
        gridColumns="220px 144px"
        label="Schedule"
      />,
    );

    const dayCol = container.querySelector('.schedule-grid__day-col');
    expect(dayCol?.getAttribute('title')).toContain('Usable time: 16.0h');

    const icon = container.querySelector('.schedule-grid__day-warning-icon') as HTMLButtonElement | null;
    expect(icon).toBeTruthy();
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseEnter(icon!);
    act(() => {
      vi.advanceTimersByTime(160);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Fragmentation risk');
    expect(tooltip.textContent).toContain('tasks scheduled today');
  });

  it('uses stronger icon styling for high fragmentation', () => {
    const { container } = render(
      <ScheduleGridHeader
        calendar={[makeDay()]}
        dayByDate={new Map([[ '2026-03-24', makeCapacity({ fragmentationRisk: 'high', fragmentationScore: 5 }) ]])}
        gridColumns="220px 144px"
        label="Schedule"
      />,
    );

    const icon = container.querySelector('.schedule-grid__day-warning-icon');
    const dayCol = container.querySelector('.schedule-grid__day-col');
    expect(icon?.className).toContain('schedule-grid__day-warning-icon--high');
    expect(dayCol?.className).not.toContain('schedule-grid__day-col--fragmented');
  });

  it('keeps staffed crew count visible in the editable header control', () => {
    const onEditDay = vi.fn();

    render(
      <ScheduleGridHeader
        calendar={[makeDay({ accessStart: '07:30', accessEnd: '15:30' })]}
        dayByDate={new Map([[ '2026-03-24', makeCapacity({ availableCrew: 6 }) ]])}
        gridColumns="220px 144px"
        label="Schedule"
        onEditDay={onEditDay}
      />,
    );

    const editButton = screen.getByRole('button', {
      name: /edit crew and hours.*1\.5\/6 crew, 7:30-15:30/i,
    });

    expect(editButton.textContent).toContain('1.5/6 crew');
    expect(editButton.textContent).toContain('7:30-15:30');

    fireEvent.click(editButton);

    expect(onEditDay).toHaveBeenCalledWith('2026-03-24', editButton);
  });

  it('reserves the utilization bar slot when a work day has no utilization', () => {
    const { container } = render(
      <ScheduleGridHeader
        calendar={[makeDay()]}
        dayByDate={new Map([[ '2026-03-24', makeCapacity({ assignedCrewTotal: 0 }) ]])}
        gridColumns="220px 144px"
        label="Schedule"
      />,
    );

    const placeholder = container.querySelector('.schedule-grid__day-bar--placeholder');

    expect(placeholder).toBeTruthy();
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
  });
});
