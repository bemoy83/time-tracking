/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createLineItem, createPlan, type WorkCalendarDay } from '../../../lib/planning/plan-model';
import { computeSharedCapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { buildSharedRows } from '../../../lib/planning/scheduling/schedule-hierarchy';
import { readPhaseDateValues } from './schedule-date-ui';
import { ScheduleGrid, type ScheduleGridEventDates } from './ScheduleGrid';

function makeCalendar(): WorkCalendarDay[] {
  return ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'].map((date) => ({
    date,
    isWorkDay: true,
    accessStart: '08:00',
    accessEnd: '16:00',
    crewSize: 4,
  }));
}

function renderSharedGrid() {
  const plan = createPlan('Plan A');
  plan.id = 'plan-a';
  plan.defaultCrewSize = 4;
  plan.assemblyStartDate = '2026-03-01';
  plan.assemblyEndDate = '2026-03-01';
  plan.eventStartDate = '2026-03-03';
  plan.eventEndDate = '2026-03-03';
  plan.dismantleStartDate = '2026-03-05';
  plan.dismantleEndDate = '2026-03-05';

  const item = createLineItem('Rig', 'Rig', 'pcs', 1, 1, 1);
  item.id = 'item-a';
  plan.lineItems = [item];

  const calendar = makeCalendar();
  const capacity = computeSharedCapacitySummary({
    calendar,
    defaultCrewSize: 4,
    lineItems: [{
      planId: plan.id,
      lineItemId: item.id,
      plan,
      item,
      readOnly: false,
    }],
  });

  const rendered = render(
    <ScheduleGrid
      mode="shared"
      rows={buildSharedRows([plan])}
      calendar={calendar}
      capacity={capacity}
      phaseDatesByPlanId={new Map([[plan.id, readPhaseDateValues(plan)]])}
      eventDatesByPlanId={new Map<string, ScheduleGridEventDates>([
        [plan.id, { eventStartDate: plan.eventStartDate, eventEndDate: plan.eventEndDate }],
      ])}
      planDisplayNameByPlanId={new Map([[plan.id, plan.title]])}
      itemByCompositeId={new Map([[`${plan.id}:${item.id}`, item]])}
      onToggleAssignment={vi.fn()}
    />,
  );

  return { ...rendered, plan, item };
}

function groupDays(button: HTMLElement): HTMLElement[] {
  return Array.from(button.querySelectorAll('.schedule-grid__group-day'));
}

describe('shared ScheduleGrid event phase rendering', () => {
  it('mirrors single project row tinting for expanded and collapsed states', () => {
    const { getByRole } = renderSharedGrid();
    const projectButton = getByRole('button', { name: /Plan A/ });

    const expandedDays = groupDays(projectButton);
    expect(expandedDays[0].className).not.toContain('--in-range');
    expect(expandedDays[2].className).toContain('--in-range');
    expect(expandedDays[4].className).not.toContain('--in-range');

    fireEvent.click(projectButton);

    const collapsedDays = groupDays(projectButton);
    expect(collapsedDays[0].className).toContain('--in-range');
    expect(collapsedDays[1].className).toContain('--in-extended');
    expect(collapsedDays[2].className).toContain('--in-range');
    expect(collapsedDays[3].className).toContain('--in-extended');
    expect(collapsedDays[4].className).toContain('--in-range');
  });

  it('marks shared phase rows with commercial and extended tints', () => {
    const { getByRole } = renderSharedGrid();
    const assemblyButton = getByRole('button', { name: /Assembly/ });
    const dismantleButton = getByRole('button', { name: /Dismantle/ });

    const assemblyDays = groupDays(assemblyButton);
    expect(assemblyDays[0].className).toContain('--in-range');
    expect(assemblyDays[1].className).toContain('--in-extended');
    expect(assemblyDays[2].className).not.toContain('--in-range');

    const dismantleDays = groupDays(dismantleButton);
    expect(dismantleDays[3].className).toContain('--in-extended');
    expect(dismantleDays[4].className).toContain('--in-range');
  });

  it('uses extended phase windows for shared item cell availability', () => {
    const { container, item } = renderSharedGrid();
    const assemblyRow = container.querySelector(`[data-row-key="item:plan-a:assembly:${item.id}"]`);
    expect(assemblyRow).toBeTruthy();
    const cells = Array.from(assemblyRow!.querySelectorAll('[role="gridcell"]'));

    expect(cells[1].getAttribute('aria-disabled')).toBeNull();
    expect(cells[2].getAttribute('aria-disabled')).toBe('true');
  });
});
