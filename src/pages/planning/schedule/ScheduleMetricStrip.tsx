import { Fragment } from 'react';
import { CheckIcon } from '../../../components/icons';
import type { SidebarMetricDescriptor } from '../workspace/workspace-metrics';
import type { SetupStep } from '../PlanSetupStepper';

interface ScheduleMetricStripProps {
  metrics: SidebarMetricDescriptor[];
  steps: SetupStep[];
  readOnly?: boolean;
}

export function ScheduleMetricStrip({ metrics, steps, readOnly = false }: ScheduleMetricStripProps) {
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
          const isActiveCta = step.isCta && !readOnly && (!step.complete || step.persistCta);

          return (
            <Fragment key={step.id}>
              {i > 0 && (
                <span className="schedule-metric-strip__step-sep" aria-hidden>→</span>
              )}
              {isActiveCta && step.onClick ? (
                <button
                  type="button"
                  className="schedule-metric-strip__step-cta"
                  onClick={step.onClick}
                  disabled={step.disabled}
                  title={step.disabledReason ?? undefined}
                  aria-label={step.disabledReason ? `${step.label}: ${step.disabledReason}` : step.label}
                >
                  {step.activeLabel ?? step.label}
                </button>
              ) : (
                <span
                  className={[
                    'schedule-metric-strip__step',
                    isCompleted ? 'schedule-metric-strip__step--done' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {isCompleted && (
                    <CheckIcon className="schedule-metric-strip__step-check" aria-hidden />
                  )}
                  {step.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
