/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useMediaQuery } from './lib/hooks/useMediaQuery';

vi.mock('./lib/hooks/useMediaQuery', () => ({
  WORKSPACE_MIN_WIDTH: '(min-width: 1024px)',
  useMediaQuery: vi.fn(),
}));

vi.mock('./lib/stores/timer-store', () => ({
  initializeTimerStore: vi.fn(() => Promise.resolve()),
  useTimerStore: vi.fn(() => ({ isLoading: false })),
}));

vi.mock('./lib/stores/task-store', () => ({
  initializeTaskStore: vi.fn(() => Promise.resolve()),
  useTaskStore: vi.fn(() => ({ isLoading: false })),
}));

vi.mock('./lib/stores/template-store', () => ({
  initializeTemplateStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/stores/work-unit-store', () => ({
  initializeWorkUnitStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/stores/work-type-store', () => ({
  initializeWorkTypeStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/stores/tag-store', () => ({
  initializeTagStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/stores/tag-sequence-store', () => ({
  initializeTagSequenceStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/stores/crew-pool-store', () => ({
  initializeCrewPoolStore: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/sync/sync-queue', () => ({
  initializeSyncQueue: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/migrations/backfill-worktype-link', () => ({
  runWorkTypeLinkBackfill: vi.fn(() => Promise.resolve()),
}));

vi.mock('./components/InstallPrompt', () => ({
  InstallPrompt: () => null,
}));

vi.mock('./pages/TodayView', () => ({
  TodayView: () => <div>Today content</div>,
}));

vi.mock('./pages/ProjectList', () => ({
  ProjectList: () => <div>Projects content</div>,
}));

vi.mock('./pages/PlanningView', () => ({
  PlanningView: () => <div>Planning workspace content</div>,
}));

vi.mock('./pages/field-plan/FieldPlanView', () => ({
  FieldPlanView: () => <div>Field plan content</div>,
}));

vi.mock('./pages/SettingsView', () => ({
  SettingsView: () => <div>Settings list content</div>,
}));

vi.mock('./pages/settings/workspace/SettingsWorkspaceShell', () => ({
  SettingsWorkspaceShell: () => <div>Settings workspace content</div>,
}));

const mockedUseMediaQuery = vi.mocked(useMediaQuery);

describe('App desktop workspace shell', () => {
  beforeEach(() => {
    mockedUseMediaQuery.mockReturnValue(true);
  });

  it('keeps global tab navigation for normal desktop tabs', async () => {
    render(<App />);

    expect(await screen.findByText('Today content')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).toBeNull();
    expect(screen.getByRole('main').className).not.toContain('main--workspace');
  });

  it('replaces global tab navigation with workspace navigation in the planning desktop workspace', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Planning' }));

    expect(await screen.findByText('Planning workspace content')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
    });
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeTruthy();
    expect(screen.getByRole('main').className).toContain('main--workspace');
  });

  it('replaces global tab navigation with workspace navigation in the settings desktop workspace', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));

    expect(await screen.findByText('Settings workspace content')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
    });
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeTruthy();
    expect(screen.getByRole('main').className).toContain('main--workspace');
  });

  it('navigates between desktop workspaces from the workspace navigation', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Planning' }));
    expect(await screen.findByText('Planning workspace content')).toBeTruthy();

    const workspaceNav = screen.getByRole('navigation', { name: 'Workspace navigation' });
    fireEvent.click(within(workspaceNav).getByRole('button', { name: 'Settings' }));

    expect(await screen.findByText('Settings workspace content')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeTruthy();
  });
});
