import { describe, expect, it, vi } from 'vitest';
import {
  getVisibleGlobalWorkspaceTabs,
  getVisiblePlanWorkspaceTabs,
  type WorkspaceRenderContext,
} from './workspace-tabs';

function createContext(overrides: Partial<WorkspaceRenderContext> = {}): WorkspaceRenderContext {
  return {
    hasLinkedTasks: false,
    isReviewed: false,
    reviewReady: false,
    showScheduleTab: true,
    onOpenProgress: vi.fn(),
    onOpenInsights: vi.fn(),
    onSetActiveTab: vi.fn(),
    ...overrides,
  };
}

describe('workspace-tabs', () => {
  it('returns global tabs regardless of plan context', () => {
    const tabs = getVisibleGlobalWorkspaceTabs(createContext({ isReviewed: true, hasLinkedTasks: false }));
    expect(tabs.map((tab) => tab.id)).toEqual(['shared-schedule', 'insights']);
  });

  it('builds base editable plan tab set', () => {
    const tabs = getVisiblePlanWorkspaceTabs(createContext({ hasLinkedTasks: false, isReviewed: false }));
    expect(tabs.map((tab) => tab.id)).toEqual(['edit', 'schedule']);
    expect(tabs.find((tab) => tab.id === 'edit')?.label).toBe('Edit');
  });

  it('shows linked-task tabs and review when eligible', () => {
    const tabs = getVisiblePlanWorkspaceTabs(createContext({
      hasLinkedTasks: true,
      isReviewed: false,
      reviewReady: true,
      showScheduleTab: true,
    }));

    expect(tabs.map((tab) => tab.id)).toEqual([
      'edit',
      'schedule',
      'progress',
      'insights',
      'review',
    ]);
  });

  it('hides schedule/review and shows report for reviewed plans', () => {
    const tabs = getVisiblePlanWorkspaceTabs(createContext({
      hasLinkedTasks: true,
      isReviewed: true,
      reviewReady: false,
      showScheduleTab: false,
    }));

    expect(tabs.map((tab) => tab.id)).toEqual([
      'edit',
      'progress',
      'insights',
      'report',
    ]);
    expect(tabs.find((tab) => tab.id === 'edit')?.label).toBe('Plan');
  });
});
