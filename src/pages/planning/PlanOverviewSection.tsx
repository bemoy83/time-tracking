import type { Project } from '../../lib/types';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ChevronRightIcon, FolderIcon, PencilIcon } from '../../components/icons';

interface PlanOverviewSectionProps {
  title: string;
  selectedProject: Project | null;
  planDisplayName: string;
  readOnly: boolean;
  isLocked: boolean;
  identityError: string | null;
  onOpenProjectPicker: () => void;
}

export function PlanOverviewSection({
  title,
  selectedProject,
  planDisplayName,
  readOnly,
  isLocked,
  identityError,
  onOpenProjectPicker,
}: PlanOverviewSectionProps) {
  return (
    <section
      className="planning-view__overview-block"
      aria-label="Plan overview"
    >
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
    </section>
  );
}
