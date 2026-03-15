import { Fragment } from 'react';
import { CheckIcon } from '../../components/icons';

interface SetupStep {
  id: string;
  label: string;
  /** Label override shown when this step is the active CTA */
  activeLabel?: string;
  complete: boolean;
  /** Whether this step acts as the primary CTA when active */
  isCta: boolean;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string | null;
}

interface PlanSetupStepperProps {
  steps: SetupStep[];
  readOnly?: boolean;
}

export function PlanSetupStepper({ steps, readOnly = false }: PlanSetupStepperProps) {
  const activeIdx = steps.findIndex((s) => !s.complete);

  return (
    <div className="plan-setup-stepper" aria-label="Plan setup progress">
      {steps.map((step, idx) => {
        const isComplete = step.complete;
        const isActive = idx === activeIdx;
        const isFuture = !isComplete && !isActive;
        const isCtaActive = isActive && step.isCta && !readOnly;
        const isLast = idx === steps.length - 1;
        const label = isCtaActive && step.activeLabel ? step.activeLabel : step.label;

        const nodeContent = isComplete
          ? <CheckIcon />
          : <span className="plan-setup-stepper__num">{idx + 1}</span>;

        const classList = [
          'plan-setup-stepper__step',
          isComplete && 'plan-setup-stepper__step--complete',
          isActive && !isCtaActive && 'plan-setup-stepper__step--active',
          isFuture && 'plan-setup-stepper__step--future',
          isCtaActive && 'plan-setup-stepper__step--cta',
          isCtaActive && step.disabled && 'plan-setup-stepper__step--cta-blocked',
        ].filter(Boolean).join(' ');

        return (
          <Fragment key={step.id}>
            {isCtaActive ? (
              <button
                type="button"
                className={classList}
                onClick={() => void step.onClick?.()}
                disabled={step.disabled === true}
                title={step.disabled && step.disabledReason ? step.disabledReason : label}
                aria-label={`${label}${step.disabled && step.disabledReason ? ` — ${step.disabledReason}` : ''}`}
              >
                <div className="plan-setup-stepper__node" aria-hidden="true">
                  {nodeContent}
                </div>
                <span className="plan-setup-stepper__label">{label}</span>
              </button>
            ) : (
              <div
                className={classList}
                aria-label={`${step.label}${isComplete ? ' — complete' : isActive ? ' — current' : ' — pending'}`}
              >
                <div className="plan-setup-stepper__node" aria-hidden="true">
                  {nodeContent}
                </div>
                <span className="plan-setup-stepper__label">{label}</span>
              </div>
            )}
            {!isLast && (
              <div
                className={`plan-setup-stepper__line${isComplete ? ' plan-setup-stepper__line--filled' : ''}`}
                aria-hidden="true"
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
