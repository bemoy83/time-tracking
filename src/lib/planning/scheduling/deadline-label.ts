import type { DeadlineStatus } from './deadline';

export function formatDeadlineStatusLabel(status: DeadlineStatus): string {
  switch (status) {
    case 'due-today': return 'Due today';
    case 'on-track': return 'On track';
    case 'at-risk': return 'At risk';
    case 'overdue': return 'Overdue';
    case 'done-on-time': return 'Done on time';
    case 'done-late': return 'Done late';
    case 'needs-replanning': return 'Needs replanning';
    case 'unscheduled':
    default:
      return 'Unscheduled';
  }
}
