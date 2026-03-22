/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsView } from './SettingsView';
import { useTaskStore } from '../lib/stores/task-store';
import { getAllTimeEntries } from '../lib/db';

vi.mock('../lib/stores/task-store', () => ({
  useTaskStore: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getAllTimeEntries: vi.fn(),
}));

const mockedUseTaskStore = vi.mocked(useTaskStore);
const mockedGetAllTimeEntries = vi.mocked(getAllTimeEntries);

describe('SettingsView', () => {
  it('uses execution return terminology in the Data Transfer entry point', () => {
    mockedUseTaskStore.mockReturnValue({
      tasks: [],
      projects: [],
    } as unknown as ReturnType<typeof useTaskStore>);
    mockedGetAllTimeEntries.mockResolvedValue([]);

    render(<SettingsView />);

    expect(screen.getByText('Import plan packages and execution returns')).toBeTruthy();
    expect(screen.queryByText(/progress reports/i)).toBeNull();
  });
});
