import { describe, expect, it } from 'vitest';
import type { TaskTemplate } from '../types';
import { exportTemplatesCsv } from './template-export';

function makeTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'tmpl-1',
    title: 'Install carpet',
    workTypeId: 'wt-carpet',
    workUnit: 'm2',
    workQuantity: 100,
    estimatedMinutes: 60,
    crew: 2,
    targetProductivity: 10,
    buildPhase: 'build-up',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportTemplatesCsv', () => {
  it('exports work package-compatible headers', () => {
    const csv = exportTemplatesCsv([], new Map());
    expect(csv).toBe(
      'title,workTypeTitle,workUnit,buildPhase,workQuantity,estimatedMinutes,defaultWorkers,targetProductivity',
    );
  });

  it('resolves workTypeTitle from workTypeTitleById', () => {
    const csv = exportTemplatesCsv(
      [makeTemplate()],
      new Map([['wt-carpet', 'Carpet Tiles']]),
    );

    const row = csv.split('\n')[1];
    expect(row).toContain('Install carpet,Carpet Tiles,m2,build-up,100,60,2,10');
  });

  it('exports empty workTypeTitle when workTypeId is null', () => {
    const csv = exportTemplatesCsv(
      [makeTemplate({ workTypeId: null })],
      new Map([['wt-carpet', 'Carpet Tiles']]),
    );

    const row = csv.split('\n')[1];
    expect(row).toMatch(/^Install carpet,,m2,build-up/);
  });

  it('exports empty workTypeTitle when id is missing in map', () => {
    const csv = exportTemplatesCsv(
      [makeTemplate({ workTypeId: 'wt-missing' })],
      new Map([['wt-carpet', 'Carpet Tiles']]),
    );

    const row = csv.split('\n')[1];
    expect(row).toMatch(/^Install carpet,,m2,build-up/);
  });
});
