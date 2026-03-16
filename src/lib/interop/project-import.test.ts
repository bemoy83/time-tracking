import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../types';
import {
  applyProjectImport,
  generateProjectImportPreview,
  parseProjectCsv,
} from './project-import';
import {
  createProject,
  findProjectByName,
  updateProjectPhaseDates,
} from '../stores/task-store';

vi.mock('../stores/task-store', () => ({
  createProject: vi.fn(),
  findProjectByName: vi.fn(),
  updateProjectPhaseDates: vi.fn(),
}));

const mockCreateProject = vi.mocked(createProject);
const mockFindProjectByName = vi.mocked(findProjectByName);
const mockUpdateProjectPhaseDates = vi.mocked(updateProjectPhaseDates);

const VALID_HEADER = 'name,assemblyStartDate,assemblyEndDate,dismantleStartDate,dismantleEndDate,eventStartDate,eventEndDate';

function csv(rows: string[]): string {
  return [VALID_HEADER, ...rows].join('\n');
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Spring Expo 2026',
    color: '#2563eb',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    assemblyStartDate: '2026-05-01',
    assemblyEndDate: '2026-05-03',
    dismantleStartDate: '2026-05-08',
    dismantleEndDate: '2026-05-09',
    eventStartDate: '2026-05-05',
    eventEndDate: '2026-05-07',
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateProject.mockReset();
  mockFindProjectByName.mockReset();
  mockUpdateProjectPhaseDates.mockReset();
});

describe('parseProjectCsv', () => {
  it('parses a valid row and preserves same-day ranges', () => {
    const result = parseProjectCsv(csv([
      'Spring Expo 2026,2026-05-01,2026-05-03,2026-05-08,2026-05-08,2026-05-05,2026-05-06',
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.items[0]).toMatchObject({
      mappingKey: 'spring expo 2026',
      name: 'Spring Expo 2026',
      dismantleStartDate: '2026-05-08',
      dismantleEndDate: '2026-05-08',
    });
  });

  it('accepts source-app header aliases with semicolon delimiter', () => {
    const result = parseProjectCsv([
      'Event name;Assembly start date;Assembly end date;Event start date;Event end date;Dismantle start date;Dismantle end date',
      'VVS GRUPPEN;2026-01-27;2026-01-29;2026-01-30;2026-01-31;2026-02-02;2026-02-03',
    ].join('\n'));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      expect.objectContaining({
        mappingKey: 'vvs gruppen',
        name: 'VVS GRUPPEN',
        assemblyStartDate: '2026-01-27',
        assemblyEndDate: '2026-01-29',
        eventStartDate: '2026-01-30',
        eventEndDate: '2026-01-31',
        dismantleStartDate: '2026-02-02',
        dismantleEndDate: '2026-02-03',
      }),
    ]);
  });

  it('rejects invalid date format and invalid date ordering', () => {
    const result = parseProjectCsv(csv([
      'Spring Expo 2026,2026/05/01,,2026-05-08,2026-05-07,,',
    ]));

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'assemblyStartDate')).toBe(true);
    expect(result.errors.some((error) => error.message.includes('on or before'))).toBe(true);
  });

  it('accepts rows with missing dates (partial or empty)', () => {
    const result = parseProjectCsv(csv([
      'Project A,,,,,,',
      'Project B,2026-05-01,2026-05-03,,,2026-05-05,2026-05-07',
    ]));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ name: 'Project A', assemblyStartDate: null, assemblyEndDate: null });
    expect(result.items[1]).toMatchObject({ name: 'Project B', assemblyStartDate: '2026-05-01', assemblyEndDate: '2026-05-03', eventStartDate: '2026-05-05', eventEndDate: '2026-05-07', dismantleStartDate: null, dismantleEndDate: null });
  });
});

describe('generateProjectImportPreview', () => {
  it('marks create and update actions by normalized project name', () => {
    const parsed = parseProjectCsv(csv([
      'Spring Expo 2026,2026-05-01,2026-05-03,2026-05-08,2026-05-09,2026-05-05,2026-05-07',
      'Autumn Expo,2026-09-01,2026-09-02,2026-09-06,2026-09-07,2026-09-03,2026-09-05',
    ]));

    const preview = generateProjectImportPreview(parsed.items, [
      makeProject({ name: '  spring   expo 2026  ' }),
    ]);

    expect(preview.summary).toEqual({ create: 1, update: 1 });
    expect(preview.items[0].action).toBe('update');
    expect(preview.items[1].action).toBe('create');
  });

  it('detects duplicate names within the import set', () => {
    const parsed = parseProjectCsv(csv([
      'Spring Expo 2026,2026-05-01,2026-05-03,2026-05-08,2026-05-09,2026-05-05,2026-05-07',
      ' spring expo 2026 ,2026-06-01,2026-06-03,2026-06-08,2026-06-09,2026-06-05,2026-06-07',
    ]));

    const preview = generateProjectImportPreview(parsed.items, []);

    expect(preview.duplicateKeys).toEqual(['spring expo 2026']);
  });
});

describe('applyProjectImport', () => {
  it('updates existing projects without renaming and creates missing projects', async () => {
    const parsed = parseProjectCsv(csv([
      'Spring Expo 2026,2026-05-01,2026-05-03,2026-05-08,2026-05-09,2026-05-05,2026-05-07',
      'Autumn Expo,2026-09-01,2026-09-02,2026-09-06,2026-09-07,2026-09-03,2026-09-05',
    ]));

    mockFindProjectByName
      .mockReturnValueOnce(makeProject({ id: 'project-existing', name: 'Legacy Name' }))
      .mockReturnValueOnce(undefined);

    const result = await applyProjectImport(parsed.items);

    expect(result).toEqual({ created: 1, updated: 1 });
    expect(mockUpdateProjectPhaseDates).toHaveBeenCalledWith('project-existing', expect.objectContaining({
      assemblyStartDate: '2026-05-01',
      eventEndDate: '2026-05-07',
    }));
    expect(mockCreateProject).toHaveBeenCalledWith('Autumn Expo', {
      phaseDates: expect.objectContaining({
        assemblyStartDate: '2026-09-01',
        dismantleEndDate: '2026-09-07',
      }),
    });
  });
});
