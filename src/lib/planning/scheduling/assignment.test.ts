import { describe, expect, it } from 'vitest';
import { toggleAssignmentDate } from './assignment';

describe('toggleAssignmentDate', () => {
  it('adds first scheduled day when unscheduled', () => {
    expect(toggleAssignmentDate({ scheduledStart: null, scheduledEnd: null }, '2026-03-02')).toEqual({
      scheduledStart: '2026-03-02',
      scheduledEnd: '2026-03-02',
    });
  });

  it('extends schedule range when clicking outside span', () => {
    expect(toggleAssignmentDate({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-03' }, '2026-03-05')).toEqual({
      scheduledStart: '2026-03-02',
      scheduledEnd: '2026-03-05',
    });
  });

  it('shrinks schedule range when toggling first day', () => {
    expect(toggleAssignmentDate({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' }, '2026-03-02')).toEqual({
      scheduledStart: '2026-03-03',
      scheduledEnd: '2026-03-04',
    });
  });

  it('clears schedule when toggling middle day to avoid split', () => {
    expect(toggleAssignmentDate({ scheduledStart: '2026-03-02', scheduledEnd: '2026-03-04' }, '2026-03-03')).toEqual({
      scheduledStart: null,
      scheduledEnd: null,
    });
  });
});
