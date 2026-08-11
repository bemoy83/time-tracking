/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspacePaneFrame } from './WorkspacePaneFrame';
import type { ResolvedWorkspaceTabDescriptor } from './workspace-tabs';

function createTabs(overrides: Partial<Record<ResolvedWorkspaceTabDescriptor['id'], () => void>> = {}) {
  return [
    { id: 'edit', label: 'Plan', onSelect: overrides.edit ?? vi.fn() },
    { id: 'progress', label: 'Progress', onSelect: overrides.progress ?? vi.fn() },
    { id: 'insights', label: 'Insights', onSelect: overrides.insights ?? vi.fn() },
  ] satisfies ResolvedWorkspaceTabDescriptor[];
}

describe('WorkspacePaneFrame', () => {
  it('links workspace tabs to the active panel', () => {
    render(
      <WorkspacePaneFrame tabs={createTabs()} activeTab="edit" ariaLabel="Plan workspace">
        <div>Workspace content</div>
      </WorkspacePaneFrame>,
    );

    const activeTab = screen.getByRole('tab', { name: 'Plan' });
    const inactiveTab = screen.getByRole('tab', { name: 'Progress' });
    const panel = screen.getByRole('tabpanel');

    expect(activeTab.getAttribute('id')).toBe('planning-workspace-tab-edit');
    expect(activeTab.getAttribute('aria-controls')).toBe('planning-workspace-panel-edit');
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
    expect(activeTab.getAttribute('tabindex')).toBe('0');
    expect(inactiveTab.getAttribute('tabindex')).toBe('-1');
    expect(panel.getAttribute('id')).toBe('planning-workspace-panel-edit');
    expect(panel.getAttribute('aria-labelledby')).toBe('planning-workspace-tab-edit');
  });

  it('activates adjacent workspace tabs from keyboard navigation', () => {
    const onProgress = vi.fn();
    render(
      <WorkspacePaneFrame tabs={createTabs({ progress: onProgress })} activeTab="edit">
        <div>Workspace content</div>
      </WorkspacePaneFrame>,
    );

    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Plan views' }), {
      key: 'ArrowRight',
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('activates first and last workspace tabs from Home and End', () => {
    const onEdit = vi.fn();
    const onInsights = vi.fn();
    render(
      <WorkspacePaneFrame tabs={createTabs({ edit: onEdit, insights: onInsights })} activeTab="progress">
        <div>Workspace content</div>
      </WorkspacePaneFrame>,
    );

    const tablist = screen.getByRole('tablist', { name: 'Plan views' });
    fireEvent.keyDown(tablist, { key: 'Home' });
    fireEvent.keyDown(tablist, { key: 'End' });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onInsights).toHaveBeenCalledTimes(1);
  });
});
