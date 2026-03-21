import type { Project } from '../../lib/types';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ChevronRightIcon, ChevronUpIcon, FolderIcon, PencilIcon } from '../../components/icons';
import { PlanSetupStepper, type SetupStep } from './PlanSetupStepper';

interface PlanOverviewSectionProps {
  title: string;
  selectedProject: Project | null;
  planDisplayName: string;
  readOnly: boolean;
  isLocked: boolean;
  identityError: string | null;
  overviewHelperText: string;
  setupSteps: SetupStep[];
  collapsed: boolean;
  onCollapse: () => void;
  onOpenProjectPicker: () => void;
}

export function PlanOverviewSection({
  title,
  selectedProject,
  planDisplayName,
  readOnly,
  isLocked,
  identityError,
  overviewHelperText,
  setupSteps,
  collapsed,
  onCollapse,
  onOpenProjectPicker,
}: PlanOverviewSectionProps) {
  return (
    <section
      className={`planning-view__overview-block${collapsed ? ' planning-view__summary-section--hidden' : ''}`}
      aria-label="Plan overview"
    >
      <button
        type="button"
        className="planning-view__summary-collapse-btn planning-view__summary-collapse-btn--card"
        onClick={onCollapse}
        aria-label="Collapse plan setup"
        title="Collapse plan setup"
      >
        <ChevronUpIcon className="planning-view__summary-collapse-icon" />
      </button>

      <div className="planning-view__overview-identity">
        <div className="planning-view__overview-field planning-view__overview-field--identity">
          <span className="planning-view__overview-label">Event/Project</span>
          {readOnly || isLocked ? (
            <div className="planning-view__identity-readonly" aria-live="polite">
              {selectedProject && (
                <ProjectColorDot color={selectedProject.color} size="md" className="planning-view__project-dot" />
              )}
              <span className="planning-view__identity-readonly-value">
                {planDisplayName || 'Untitled plan'}
              </span>
            </div>
          ) : selectedProject ? (
            <div className="planning-view__identity-assigned-row">
              <button
                type="button"
                className="planning-view__project-button planning-view__project-button--selected"
                onClick={onOpenProjectPicker}
                aria-label={`Change project: ${selectedProject.name}`}
              >
                <span className="planning-view__project-selected">
                  <ProjectColorDot color={selectedProject.color} size="md" className="planning-view__project-dot" />
                  <span>{selectedProject.name}</span>
                  <PencilIcon className="planning-view__project-edit-icon" />
                </span>
              </button>
            </div>
          ) : (
            <div className="planning-view__identity-assigned-row">
              <button
                type="button"
                className={`planning-view__identity-trigger${title.trim() ? ' planning-view__identity-trigger--has-value' : ''}`}
                onClick={onOpenProjectPicker}
                aria-label={title.trim() ? `Edit plan name: ${title}` : 'Set event or project'}
              >
                {title.trim() ? (
                  <>
                    <span className="planning-view__identity-trigger-value">{title}</span>
                    <PencilIcon className="planning-view__project-edit-icon" />
                  </>
                ) : (
                  <>
                    <FolderIcon className="planning-view__identity-picker-icon" />
                    <span className="planning-view__identity-trigger-placeholder">Set event or project…</span>
                    <ChevronRightIcon className="planning-view__identity-picker-chevron" />
                  </>
                )}
              </button>
            </div>
          )}
          {identityError && (
            <span className="planning-view__overview-error" role="alert">
              {identityError}
            </span>
          )}
        </div>
      </div>

      <div className="planning-view__overview-content">
        <div className="planning-view__overview-context">
          <p className="planning-view__overview-helper">{overviewHelperText}</p>
        </div>
      </div>

      <PlanSetupStepper steps={setupSteps} readOnly={readOnly} />
    </section>
  );
}
