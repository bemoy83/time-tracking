import type { Plan } from '../../lib/planning/plan-model';
import { sanitizeFileNameSegment } from '../../lib/utils/sanitize-filename';

export function buildExecutionReturnFileName(
  planDisplayName: string,
  exportedAt: string,
): string {
  return `execution-return-${sanitizeFileNameSegment(planDisplayName)}-${exportedAt.slice(0, 10)}.json`;
}

export function buildExecutionReturnExportConfirmation(args: {
  planDisplayName: string;
  filename: string;
  summary: {
    completed: number;
    inProgress: number;
    blocked: number;
    deferred: number;
    pending: number;
    unplannedTaskCount: number;
    timeEntryCount: number;
  };
}): string {
  return [
    'Export execution return?',
    '',
    `Plan: ${args.planDisplayName}`,
    `File: ${args.filename}`,
    `Completed: ${args.summary.completed}`,
    `In progress: ${args.summary.inProgress}`,
    `Blocked: ${args.summary.blocked}`,
    `Deferred: ${args.summary.deferred}`,
    `Pending: ${args.summary.pending}`,
    `Unplanned tasks: ${args.summary.unplannedTaskCount}`,
    `Time entries: ${args.summary.timeEntryCount}`,
    '',
    'You can export again anytime until the plan is archived.',
  ].join('\n');
}

export function markExecutionReturnExported(plan: Plan, exportedAt: string): Plan {
  return {
    ...plan,
    status: 'received',
    lastExecutionReturnExportedAt: exportedAt,
    sessionClosedAt: null,
    updatedAt: exportedAt,
  };
}
