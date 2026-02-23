/**
 * WorkTypePicker — reusable dropdown for selecting a WorkType.
 * Shows a <select> with formatted option labels, empty-state messaging,
 * and an optional expected-rate hint below.
 */

import type { WorkType } from '../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../lib/types';

interface WorkTypePickerProps {
  workTypes: WorkType[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  emptyMessage?: string;
  placeholder?: string;
  showRate?: boolean;
  className?: string;
}

export function WorkTypePicker({
  workTypes,
  selectedId,
  onChange,
  emptyMessage = 'No work types yet.',
  placeholder = 'None',
  showRate = false,
  className,
}: WorkTypePickerProps) {
  const selectedWorkType = selectedId
    ? workTypes.find((wt) => wt.id === selectedId) ?? null
    : null;

  return (
    <div className={className}>
      <label className="entry-modal__label">Work Type</label>
      {workTypes.length === 0 ? (
        <div className="task-work-quantity__hint">{emptyMessage}</div>
      ) : (
        <select
          className="input"
          value={selectedId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Work Type"
        >
          <option value="">{placeholder}</option>
          {workTypes.map((wt) => (
            <option key={wt.id} value={wt.id}>
              {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]} · {BUILD_PHASE_LABELS[wt.buildPhase]}
            </option>
          ))}
        </select>
      )}
      {showRate && selectedWorkType && (
        <div className="task-work-quantity__hint">
          Expected: {selectedWorkType.expectedProductivity} {WORK_UNIT_LABELS[selectedWorkType.workUnit]}/person-hr
        </div>
      )}
    </div>
  );
}
