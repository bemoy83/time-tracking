import type { CSSProperties } from 'react';
import type { WorkUnitImportPreview } from '../lib/interop/work-unit-import-preview';

interface WorkUnitImportPreviewPanelProps {
  preview: WorkUnitImportPreview | null;
  applyImportedLabels: boolean;
  onApplyImportedLabelsChange: (value: boolean) => void;
  summaryElement?: 'p' | 'div' | 'span';
  summaryClassName?: string;
  toggleClassName?: string;
  toggleStyle?: CSSProperties;
  toggleLabel?: string;
}

export function WorkUnitImportPreviewPanel({
  preview,
  applyImportedLabels,
  onApplyImportedLabelsChange,
  summaryElement: SummaryElement = 'p',
  summaryClassName = 'field-plan-import-card__meta',
  toggleClassName = 'settings-view__row settings-view__row--toggle',
  toggleStyle,
  toggleLabel = 'Apply file labels to existing units',
}: WorkUnitImportPreviewPanelProps) {
  if (!preview) {
    return null;
  }

  return (
    <>
      <SummaryElement className={summaryClassName}>
        Units: {preview.newUnits.length} new, {preview.labelConflicts.length} label conflict{preview.labelConflicts.length === 1 ? '' : 's'}.
      </SummaryElement>
      {preview.labelConflicts.length > 0 && (
        <label className={toggleClassName} style={toggleStyle}>
          <span className="settings-view__row-label">{toggleLabel}</span>
          <input
            type="checkbox"
            className="settings-view__toggle"
            checked={applyImportedLabels}
            onChange={(event) => onApplyImportedLabelsChange(event.target.checked)}
          />
        </label>
      )}
    </>
  );
}
