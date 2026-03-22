/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDataTransferView } from './SettingsDataTransferView';
import {
  CANONICAL_HANDOFF_EXPLANATION,
  PLANNER_EXECUTION_RETURN_EXPLANATION,
} from '../../lib/interop/data-transfer/handoff-copy';

vi.mock('./cards/FullBackupTransferCard', () => ({
  FullBackupTransferCard: () => (
    <>
      <div className="settings-view__card">
        <h2>Export Full Backup</h2>
      </div>
      <div className="settings-view__card">
        <h2>Import Full Backup</h2>
      </div>
    </>
  ),
}));

vi.mock('./cards/PlanPackageTransferCard', () => ({
  PlanPackageTransferCard: () => (
    <div className="settings-view__card">
      <h2>Import Plan Package</h2>
    </div>
  ),
}));

vi.mock('./cards/ExecutionReturnTransferCard', () => ({
  ExecutionReturnTransferCard: () => (
    <div className="settings-view__card">
      <h2>Import Execution Return</h2>
      <p>{PLANNER_EXECUTION_RETURN_EXPLANATION}</p>
      <p>{CANONICAL_HANDOFF_EXPLANATION}</p>
    </div>
  ),
}));

describe('SettingsDataTransferView', () => {
  it('renders the transfer cards in the expected order and preserves handoff copy', () => {
    render(<SettingsDataTransferView onBack={vi.fn()} />);

    expect(screen.getByText(new RegExp(PLANNER_EXECUTION_RETURN_EXPLANATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
    expect(screen.getByText(new RegExp(CANONICAL_HANDOFF_EXPLANATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();

    const cardTitles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(cardTitles).toEqual([
      'Export Full Backup',
      'Import Full Backup',
      'Import Plan Package',
      'Import Execution Return',
    ]);
  });
});
