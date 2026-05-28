import { describe, expect, it } from 'vitest';
import { getEventGroupDayTint, getPhaseGroupDayTint } from './schedule-grid-group-day-tint';

describe('getPhaseGroupDayTint', () => {
  it('marks commercial and extended windows', () => {
    const commercial = { start: '2026-04-10', end: '2026-04-12' };
    const extended = { start: '2026-04-13', end: '2026-04-14' };

    expect(getPhaseGroupDayTint('2026-04-11', commercial, extended).className).toContain('--in-range');
    expect(getPhaseGroupDayTint('2026-04-13', commercial, extended).className).toContain('--in-extended');
    expect(getPhaseGroupDayTint('2026-04-09', commercial, extended).className).toBe('schedule-grid__group-day');
  });
});

describe('getEventGroupDayTint', () => {
  const phaseDates = {
    assemblyStartDate: '2026-04-01',
    assemblyEndDate: '2026-04-05',
    dismantleStartDate: '2026-04-20',
    dismantleEndDate: '2026-04-22',
  };

  it('uses zone colors when collapsed', () => {
    const assembly = getEventGroupDayTint('2026-04-03', {
      isEventCollapsed: true,
      phaseDates,
      eventStartDate: '2026-04-10',
      eventEndDate: '2026-04-15',
      eventDateRange: { start: '2026-04-10', end: '2026-04-15' },
    });
    expect(assembly.className).toContain('--in-range');
    expect(assembly.style).toEqual({ '--phase-header-spacer-bg': 'var(--wp-phase-assembly-header-bg)' });

    const eventZone = getEventGroupDayTint('2026-04-12', {
      isEventCollapsed: true,
      phaseDates,
      eventStartDate: '2026-04-10',
      eventEndDate: '2026-04-15',
      eventDateRange: { start: '2026-04-10', end: '2026-04-15' },
    });
    expect(eventZone.className).toContain('--in-range');
    expect(eventZone.style).toBeUndefined();
  });

  it('marks event span when expanded', () => {
    const inEvent = getEventGroupDayTint('2026-04-12', {
      isEventCollapsed: false,
      phaseDates,
      eventStartDate: '2026-04-10',
      eventEndDate: '2026-04-15',
      eventDateRange: { start: '2026-04-10', end: '2026-04-15' },
    });
    expect(inEvent.className).toContain('--in-range');

    const outside = getEventGroupDayTint('2026-04-01', {
      isEventCollapsed: false,
      phaseDates,
      eventStartDate: '2026-04-10',
      eventEndDate: '2026-04-15',
      eventDateRange: { start: '2026-04-10', end: '2026-04-15' },
    });
    expect(outside.className).toBe('schedule-grid__group-day');
  });
});
