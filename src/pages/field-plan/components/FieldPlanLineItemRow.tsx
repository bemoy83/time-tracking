import {
  BlockedIcon,
  ChevronRightIcon,
  PencilIcon,
  PlayIcon,
} from '../../../components/icons';
import { CountBadge } from '../../../components/CountBadge';
import { SwipeableRow } from '../../../components/SwipeableRow';
import { TaskProjectDot } from '../../../components/TaskItemMeta';
import { formatDeadlineStatusLabel } from '../../../lib/planning/scheduling/deadline-label';
import { getPhaseQuantity } from '../../../lib/planning/plan-model';
import { BUILD_PHASE_LABELS, WORK_UNIT_LABELS } from '../../../lib/types';
import type { FieldPlanLineItemSummary } from '../field-plan-model';

interface FieldPlanLineItemRowProps {
  lineItem: FieldPlanLineItemSummary;
  projectColor?: string;
  canExecute: boolean;
  onRelease: (lineItem: FieldPlanLineItemSummary) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
}

export function FieldPlanLineItemRow({
  lineItem,
  projectColor,
  canExecute,
  onRelease,
  onOpenActions,
}: FieldPlanLineItemRowProps) {
  const { item, phase, phaseFields: pf, status, tasks: linkedTasks } = lineItem;
  const quantity = getPhaseQuantity(item, phase);
  const canRelease = canExecute && !item.removedFromSource && status === 'pending' && linkedTasks.length === 0;
  const canAct = canExecute && !item.removedFromSource;

  const leftAction = canRelease
    ? {
        label: 'Release',
        icon: <PlayIcon className="swipeable-row__action-icon" />,
        color: 'var(--color-primary)',
        onAction: () => onRelease(lineItem),
      }
    : undefined;

  const rightAction = canAct
    ? {
        label: 'Actions',
        icon: <PencilIcon className="swipeable-row__action-icon" />,
        color: 'var(--color-text-muted)',
        onAction: () => onOpenActions(lineItem),
      }
    : undefined;

  return (
    <SwipeableRow
      leftAction={leftAction}
      rightAction={rightAction}
      onLongPress={canAct ? () => onOpenActions(lineItem) : undefined}
    >
      <button
        type="button"
        className={`field-plan-row field-plan-row--${status}${item.removedFromSource ? ' field-plan-row--removed' : ''}`}
        onClick={canAct ? () => onOpenActions(lineItem) : undefined}
      >
        <div className="field-plan-row__status-col">
          {projectColor && (
            <TaskProjectDot
              color={projectColor}
              className="field-plan-row__project-dot"
            />
          )}
        </div>
        <div className="field-plan-row__content">
          <span className="field-plan-row__title">{item.title}</span>
          <span className="field-plan-row__meta">
            {item.workTypeTitle} · {quantity} {WORK_UNIT_LABELS[item.workUnit]} · {BUILD_PHASE_LABELS[phase]} · {pf.crew} crew · {pf.timeHours.toFixed(1)}h
          </span>
          {pf.blockReason && (
            <span className="field-plan-row__chip field-plan-row__chip--blocked">
              <BlockedIcon className="field-plan-row__chip-icon" />
              {pf.blockReason}
            </span>
          )}
          {pf.deferredNote && (
            <span className="field-plan-row__chip field-plan-row__chip--deferred">
              Deferred: {pf.deferredNote}
            </span>
          )}
          {pf.executorNote && (
            <span className="field-plan-row__note">
              Note: {pf.executorNote}
            </span>
          )}
          {item.removedFromSource && (
            <span className="field-plan-row__chip field-plan-row__chip--removed">Removed from source</span>
          )}
          {lineItem.deadlineStatus !== 'unscheduled' && (
            <span className={`field-plan-row__deadline field-plan-row__deadline--${lineItem.deadlineStatus}`}>
              {formatDeadlineStatusLabel(lineItem.deadlineStatus)}
              {lineItem.dueDate ? ` · Due ${lineItem.dueDate}` : ''}
            </span>
          )}
        </div>
        <div className="field-plan-row__trail">
          {linkedTasks.length > 0 && (
            <CountBadge count={linkedTasks.length} variant="muted" size="compact" />
          )}
          <ChevronRightIcon className="field-plan-row__chevron" />
        </div>
      </button>
    </SwipeableRow>
  );
}
