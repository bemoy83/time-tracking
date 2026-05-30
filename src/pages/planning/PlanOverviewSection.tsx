import { useState, type ReactNode } from 'react';
import type { Project } from '../../lib/types';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ChevronRightIcon, FolderIcon, PencilIcon } from '../../components/icons';
import { DEFAULT_PLAN_EFFICIENCY } from '../../lib/planning/plan-model';

const EFFICIENCY_PRESETS = [
  { value: '80', label: 'Conservative — 80%' },
  { value: '90', label: 'Normal — 90%' },
  { value: '100', label: 'Full pace — 100%' },
] as const;

interface PlanOverviewSectionProps {
  title: string;
  selectedProject: Project | null;
  planDisplayName: string;
  readOnly: boolean;
  isLocked: boolean;
  identityError: string | null;
  defaultCrewSize: number | null;
  defaultEfficiency: number | null;
  onOpenProjectPicker: () => void;
  onDefaultCrewSizeChange: (value: string) => void;
  onDefaultEfficiencyChange: (value: string) => void;
  children?: ReactNode;
}

export function PlanOverviewSection({
  title,
  selectedProject,
  planDisplayName,
  readOnly,
  isLocked,
  identityError,
  defaultCrewSize,
  defaultEfficiency,
  onOpenProjectPicker,
  onDefaultCrewSizeChange,
  onDefaultEfficiencyChange,
  children,
}: PlanOverviewSectionProps) {
  const currentPct =
    defaultEfficiency != null
      ? Math.round(defaultEfficiency * 100)
      : Math.round(DEFAULT_PLAN_EFFICIENCY * 100);
  const isKnownPreset = EFFICIENCY_PRESETS.some((p) => p.value === String(currentPct));
  const [customMode, setCustomMode] = useState(() => !isKnownPreset);
  const selectValue = customMode ? 'custom' : String(currentPct);

  function handleEfficiencySelectChange(val: string) {
    if (val === 'custom') {
      setCustomMode(true);
    } else {
      setCustomMode(false);
      onDefaultEfficiencyChange(val);
    }
  }

  const isReadOnly = readOnly || isLocked;

  return (
    <section
      className="planning-view__overview-block"
      aria-label="Plan overview"
    >
      <div className="planning-view__overview-identity">
        <div className="planning-view__overview-field planning-view__overview-field--identity">
          <span className="planning-view__overview-label">Event/Project</span>
          {isReadOnly ? (
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

        <div className="planning-view__overview-crew">
          <label className="planning-view__overview-crew-field">
            <span className="planning-view__overview-crew-label">Crew</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              disabled={isReadOnly}
              value={defaultCrewSize ?? ''}
              onChange={(e) => onDefaultCrewSizeChange(e.target.value)}
            />
          </label>
          <div className="planning-view__overview-crew-field">
            <span className="planning-view__overview-crew-label">Efficiency</span>
            <select
              className="input"
              disabled={isReadOnly}
              value={selectValue}
              onChange={(e) => handleEfficiencySelectChange(e.target.value)}
            >
              {EFFICIENCY_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            <div className={`planning-view__overview-efficiency-slider${customMode ? '' : ' planning-view__overview-efficiency-slider--hidden'}`}>
              <input
                type="range"
                min={60}
                max={100}
                step={1}
                disabled={isReadOnly || !customMode}
                value={Math.min(100, Math.max(60, currentPct))}
                onChange={(e) => onDefaultEfficiencyChange(e.target.value)}
              />
              <span className="planning-view__overview-efficiency-pct">{currentPct}%</span>
            </div>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
