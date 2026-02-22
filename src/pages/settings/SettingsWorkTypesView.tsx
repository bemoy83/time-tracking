import { useState } from 'react';
import { useWorkTypeStore, removeWorkType } from '../../lib/stores/work-type-store';
import type { WorkType } from '../../lib/types';
import { WORK_UNIT_LABELS, BUILD_PHASE_LABELS } from '../../lib/types';
import { WorkTypeFormSheet } from '../../components/WorkTypeFormSheet';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsWorkTypesViewProps {
  onBack: () => void;
}

export function SettingsWorkTypesView({ onBack }: SettingsWorkTypesViewProps) {
  const { workTypes } = useWorkTypeStore();
  const [showWorkTypeForm, setShowWorkTypeForm] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);

  const handleAddWorkType = () => {
    setEditingWorkType(null);
    setShowWorkTypeForm(true);
  };

  const handleEditWorkType = (wt: WorkType) => {
    setEditingWorkType(wt);
    setShowWorkTypeForm(true);
  };

  const handleCloseWorkTypeForm = () => {
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

  const handleDeleteWorkType = async () => {
    if (!editingWorkType) return;
    await removeWorkType(editingWorkType.id);
    setShowWorkTypeForm(false);
    setEditingWorkType(null);
  };

  return (
    <SettingsDetailLayout title="Work Types" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Work Types</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleAddWorkType}
          >
            + Add
          </button>
        </div>
        <p className="settings-view__helper">Add and manage work categories for estimates</p>

        {workTypes.length === 0 ? (
          <p className="settings-view__empty">No work types yet. Add one to categorise tasks.</p>
        ) : (
          <div className="settings-view__list">
            {workTypes.map((wt) => (
              <button
                key={wt.id}
                className="settings-view__row"
                onClick={() => handleEditWorkType(wt)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{wt.title}</span>
                  <span className="settings-view__row-detail">
                    {BUILD_PHASE_LABELS[wt.buildPhase]} · {WORK_UNIT_LABELS[wt.workUnit]} · {wt.expectedProductivity} {WORK_UNIT_LABELS[wt.workUnit]}/person-hr
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <WorkTypeFormSheet
        isOpen={showWorkTypeForm}
        onClose={handleCloseWorkTypeForm}
        workType={editingWorkType}
        onDelete={editingWorkType ? handleDeleteWorkType : undefined}
      />
    </SettingsDetailLayout>
  );
}
