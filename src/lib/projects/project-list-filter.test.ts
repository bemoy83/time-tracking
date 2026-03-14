import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';
import {
  addDaysToDateKey,
  filterProjectsByTimeline,
  getProjectTimelineFilter,
  getTodayDateKey,
} from './project-list-filter';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Spring Expo',
    color: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    eventStartDate: null,
    eventEndDate: null,
    ...overrides,
  };
}

describe('project-list-filter', () => {
  it('formats today as a date key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T11:00:00.000Z'));

    expect(getTodayDateKey()).toBe('2026-01-15');

    vi.useRealTimers();
  });

  it('adds days using fixed UTC date math', () => {
    expect(addDaysToDateKey('2026-01-01', 90)).toBe('2026-04-01');
  });

  it('classifies current projects including boundary dates', () => {
    expect(getProjectTimelineFilter(makeProject({
      assemblyStartDate: '2026-01-15',
      dismantleEndDate: '2026-02-01',
    }), '2026-01-15')).toBe('current');

    expect(getProjectTimelineFilter(makeProject({
      assemblyStartDate: '2026-01-01',
      dismantleEndDate: '2026-01-15',
    }), '2026-01-15')).toBe('current');
  });

  it('classifies next-90d projects including the cutoff boundary', () => {
    expect(getProjectTimelineFilter(makeProject({
      assemblyStartDate: '2026-04-01',
      dismantleEndDate: '2026-04-10',
    }), '2026-01-01')).toBe('next-90d');
  });

  it('classifies past projects after dismantle end', () => {
    expect(getProjectTimelineFilter(makeProject({
      assemblyStartDate: '2025-12-01',
      dismantleEndDate: '2026-01-14',
    }), '2026-01-15')).toBe('past');
  });

  it('classifies partially dated projects as unclassified', () => {
    expect(getProjectTimelineFilter(makeProject({
      assemblyStartDate: '2026-01-20',
      dismantleEndDate: null,
    }), '2026-01-15')).toBe('unclassified');
  });

  it('filters projects by the requested timeline bucket', () => {
    const projects = [
      makeProject({ id: 'current', assemblyStartDate: '2026-01-01', dismantleEndDate: '2026-01-30' }),
      makeProject({ id: 'next', assemblyStartDate: '2026-02-15', dismantleEndDate: '2026-02-20' }),
      makeProject({ id: 'past', assemblyStartDate: '2025-12-01', dismantleEndDate: '2025-12-10' }),
      makeProject({ id: 'unclassified', assemblyStartDate: null, dismantleEndDate: null }),
    ];

    expect(filterProjectsByTimeline(projects, 'all', '2026-01-15').map((project) => project.id)).toEqual([
      'current',
      'next',
      'past',
      'unclassified',
    ]);
    expect(filterProjectsByTimeline(projects, 'current', '2026-01-15').map((project) => project.id)).toEqual(['current']);
    expect(filterProjectsByTimeline(projects, 'next-90d', '2026-01-15').map((project) => project.id)).toEqual(['next']);
    expect(filterProjectsByTimeline(projects, 'past', '2026-01-15').map((project) => project.id)).toEqual(['past']);
  });
});
