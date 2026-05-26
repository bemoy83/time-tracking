import { Fragment } from 'react';
import { CheckIcon } from '../../../components/icons';
import type { SidebarMetricDescriptor } from '../workspace/workspace-metrics';
import type { SetupStep } from '../PlanSetupStepper';

interface ScheduleMetricStripProps {
  metrics: SidebarMetricDescriptor[];
  steps: SetupStep[];
  readOnly?: boolean;
  issueCount?: number;
  criticalIssueCount?: number;
  warningIssueCount?: number;
  onOpenAssistant?: () => void;
  isLocked?: boolean;
  onRevertToDraft?: () => void;
}

export function ScheduleMetricStrip({
  metrics,
  steps,
  readOnly = false,
  issueCount = 0,
  criticalIssueCount = 0,
  warningIssueCount = 0,
  onOpenAssistant,
  isLocked = false,
  onRevertToDraft,
}: ScheduleMetricStripProps) {
  const assistantVariant =
    criticalIssueCount > 0
      ? 'critical'
      : issueCount > 0 || warningIssueCount > 0
        ? 'warning'
        : 'neutral';

  const assistantLabel =
    issueCount > 0
      ? `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`
      : 'Schedule Assistant';

  return (
    <div className="schedule-metric-strip" role="status" aria-label="Schedule status">
      <div className="schedule-metric-strip__metrics">
        {metrics.map((m, i) => (
          <Fragment key={m.label || i}>
            {i > 0 && <span className="schedule-metric-strip__divider" aria-hidden>·</span>}
            <span
              className={`schedule-metric-strip__metric${m.variant === 'risk' ? ' schedule-metric-strip__metric--risk' : ''}`}
            >
              <span className="schedule-metric-strip__value">{m.value}</span>
              {m.label && (
                <span className="schedule-metric-strip__label">{m.label}</span>
              )}
            </span>
          </Fragment>
        ))}
      </div>

      <div className="schedule-metric-strip__stepper" aria-label="Setup steps">
        {steps.map((step, i) => {
          const isCompleted = step.complete;
          const isCurrent = step.isCta && !readOnly && (!step.complete || step.persistCta);

          return (
            <Fragment key={step.id}>
              {i > 0 && (
                <span className="schedule-metric-strip__step-sep" aria-hidden>·</span>
              )}
              <span
                className={[
                  'schedule-metric-strip__step',
                  isCompleted ? 'schedule-metric-strip__step--done' : '',
                  isCurrent ? 'schedule-metric-strip__step--current' : '',
                ].filter(Boolean).join(' ')}
              >
                {isCompleted && (
                  <CheckIcon className="schedule-metric-strip__step-check" aria-hidden />
                )}
                {step.activeLabel && isCurrent ? step.activeLabel : step.label}
              </span>
            </Fragment>
          );
        })}
      </div>

      <div className="schedule-metric-strip__actions">
        {!readOnly && isLocked && onRevertToDraft && (
          <button
            type="button"
            className="btn btn--xs btn--ghost schedule-metric-strip__revert-btn"
            onClick={onRevertToDraft}
          >
            Revert to Draft
          </button>
        )}
        <button
          type="button"
          className={[
            'btn',
            'btn--xs',
            assistantVariant === 'neutral' ? 'btn--secondary' : '',
            'schedule-metric-strip__assistant-btn',
            assistantVariant === 'warning' ? 'schedule-metric-strip__assistant-btn--warning' : '',
            assistantVariant === 'critical' ? 'schedule-metric-strip__assistant-btn--critical' : '',
          ].filter(Boolean).join(' ')}
          onClick={onOpenAssistant}
          aria-haspopup="dialog"
          aria-label={
            assistantVariant === 'neutral'
              ? 'Open schedule assistant'
              : `${assistantLabel} — open schedule assistant`
          }
        >
          {assistantLabel}
        </button>
      </div>
    </div>
  );
}
