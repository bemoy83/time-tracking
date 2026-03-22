import { describe, expect, it } from 'vitest';
import { createPlan } from '../../lib/planning/plan-model';
import {
  buildExecutionReturnExportConfirmation,
  buildExecutionReturnFileName,
  markExecutionReturnExported,
} from './field-plan-handoff';

describe('field-plan handoff helpers', () => {
  it('builds a user-facing execution return filename from the display name and date', () => {
    expect(buildExecutionReturnFileName('Main Event / Hall A', '2026-03-22T18:10:00.000Z')).toBe(
      'execution-return-main-event-hall-a-2026-03-22.json',
    );
  });

  it('builds stable confirmation copy for export', () => {
    expect(buildExecutionReturnExportConfirmation({
      planDisplayName: 'Main Event',
      filename: 'execution-return-main-event-2026-03-22.json',
      summary: {
        completed: 4,
        inProgress: 1,
        blocked: 2,
        deferred: 0,
        pending: 3,
        unplannedTaskCount: 2,
        timeEntryCount: 7,
      },
    })).toContain('File: execution-return-main-event-2026-03-22.json');
  });

  it('marks a plan with the last successful execution return export timestamp', () => {
    const plan = createPlan('Main Event');
    const updated = markExecutionReturnExported(plan, '2026-03-22T18:10:00.000Z');

    expect(updated.lastExecutionReturnExportedAt).toBe('2026-03-22T18:10:00.000Z');
    expect(updated.updatedAt).toBe('2026-03-22T18:10:00.000Z');
    expect(updated.status).toBe('received');
    expect(updated.sessionClosedAt).toBeNull();
  });
});
