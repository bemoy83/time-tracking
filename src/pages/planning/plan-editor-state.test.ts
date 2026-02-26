import { describe, expect, it } from 'vitest';
import { shouldClearPlanProjectId, shouldResyncEditorState } from './plan-editor-state';

describe('shouldResyncEditorState', () => {
  it('returns true when plan id changes', () => {
    expect(
      shouldResyncEditorState(
        { id: 'plan-a', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'plan-b', updatedAt: '2024-01-01T00:00:00.000Z' },
      ),
    ).toBe(true);
  });

  it('returns true when updatedAt changes', () => {
    expect(
      shouldResyncEditorState(
        { id: 'plan-a', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'plan-a', updatedAt: '2024-01-02T00:00:00.000Z' },
      ),
    ).toBe(true);
  });

  it('returns false when id and updatedAt are unchanged', () => {
    expect(
      shouldResyncEditorState(
        { id: 'plan-a', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'plan-a', updatedAt: '2024-01-01T00:00:00.000Z' },
      ),
    ).toBe(false);
  });
});

describe('shouldClearPlanProjectId', () => {
  it('returns false for null projectId', () => {
    expect(shouldClearPlanProjectId(null, [{ id: 'project-a' }])).toBe(false);
  });

  it('returns false when project exists', () => {
    expect(shouldClearPlanProjectId('project-a', [{ id: 'project-a' }])).toBe(false);
  });

  it('returns true when project is missing', () => {
    expect(shouldClearPlanProjectId('project-missing', [{ id: 'project-a' }])).toBe(true);
  });
});
