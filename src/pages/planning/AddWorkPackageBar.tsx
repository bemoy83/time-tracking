import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { resolveWorkUnitLabel } from '../../lib/types';
import type { PlanLineItem } from '../../lib/planning/plan-model';
import { createLineItem } from '../../lib/planning/plan-model';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import type { WorkUnitImportPreview } from '../../lib/interop/work-unit-import-preview';
import { WorkUnitImportPreviewPanel } from '../../components/WorkUnitImportPreviewPanel';
import { WorkTypePicker } from '../../components/WorkTypePicker';

interface AddWorkPackageBarProps {
  onAdd: (item: PlanLineItem) => void;
  importPendingCount: number | null;
  importWorkUnitPreview: WorkUnitImportPreview | null;
  applyImportedUnitLabels: boolean;
  onApplyImportedUnitLabelsChange: (value: boolean) => void;
  isImportApplying: boolean;
  importFileInputRef: RefObject<HTMLInputElement>;
  onImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportConfirm: () => void | Promise<void>;
  onImportCancel: () => void;
}

export function AddWorkPackageBar({
  onAdd,
  importPendingCount,
  importWorkUnitPreview,
  applyImportedUnitLabels,
  onApplyImportedUnitLabelsChange,
  isImportApplying,
  importFileInputRef,
  onImportFileChange,
  onImportConfirm,
  onImportCancel,
}: AddWorkPackageBarProps) {
  const { workTypes } = useWorkTypeStore();
  const selectableWorkTypes = workTypes.filter((wt) => wt.readOnly !== true);

  const addTitleRef = useRef<HTMLInputElement>(null);
  const workTypeFieldLabelId = useId();
  const [newTitle, setNewTitle] = useState('');
  const [newWorkTypeId, setNewWorkTypeId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [addMode, setAddMode] = useState<'manual' | 'csv'>('manual');

  useEffect(() => {
    if (selectableWorkTypes.length === 0) {
      if (newWorkTypeId) setNewWorkTypeId('');
      return;
    }
    const isCurrentValid = selectableWorkTypes.some((wt) => wt.id === newWorkTypeId);
    if (!isCurrentValid) {
      setNewWorkTypeId(selectableWorkTypes[0].id);
    }
  }, [newWorkTypeId, selectableWorkTypes]);

  const newWorkType = newWorkTypeId
    ? selectableWorkTypes.find((wt) => wt.id === newWorkTypeId) ?? null
    : null;
  const newQuantityValue = (() => {
    const parsed = Number(newQuantity);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  })();
  const hasValidNewQuantity = newQuantity.trim() !== '' && newQuantityValue > 0;
  const addDisabledReason =
    selectableWorkTypes.length === 0
      ? 'No work types available'
      : !newTitle.trim()
        ? 'Title required'
        : newWorkType == null
          ? 'Type required'
          : !hasValidNewQuantity
            ? 'Quantity must be greater than 0'
            : null;

  const handleAddRow = () => {
    if (!newWorkType || !newTitle.trim() || !hasValidNewQuantity) return;
    onAdd(
      createLineItem(
        newTitle.trim(),
        newWorkType.title,
        newWorkType.workUnit,
        newQuantityValue,
        newWorkType.assemblyRate,
        newWorkType.dismantleRate,
        'template',
        newWorkType.id,
        newWorkType.tagIds ?? [],
      ),
    );
    setNewTitle('');
    setNewQuantity('');
    addTitleRef.current?.focus();
  };

  return (
    <div className="planning-view__wp-add-zone">
      <div className="planning-view__wp-add-bar">
        {importPendingCount !== null ? (
          <div className="planning-view__wp-add-mode planning-view__wp-add-mode--csv-confirm">
            <div className="planning-view__import-confirm">
              <span>
                Import {importPendingCount} package{importPendingCount !== 1 ? 's' : ''}
              </span>
              <WorkUnitImportPreviewPanel
                preview={importWorkUnitPreview}
                applyImportedLabels={applyImportedUnitLabels}
                onApplyImportedLabelsChange={onApplyImportedUnitLabelsChange}
                summaryElement="span"
                summaryClassName=""
                toggleStyle={{ display: 'inline-flex', marginLeft: 12 }}
                toggleLabel="Apply file labels"
              />
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  void onImportConfirm();
                  setAddMode('manual');
                }}
                disabled={isImportApplying}
              >
                Confirm
              </button>
              <button className="btn btn--ghost btn--sm" onClick={onImportCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="task-work-quantity__unit-pills planning-view__wp-add-segments"
              role="group"
              aria-label="Add work packages by"
            >
              <button
                type="button"
                role="radio"
                aria-checked={addMode === 'manual'}
                className={`task-work-quantity__unit-pill${addMode === 'manual' ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setAddMode('manual')}
              >
                Add manually
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={addMode === 'csv'}
                className={`task-work-quantity__unit-pill${addMode === 'csv' ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setAddMode('csv')}
              >
                Import CSV
              </button>
            </div>

            {addMode === 'manual' ? (
              <>
                <p className="planning-view__wp-add-bar-help">
                  List the work needed for this project/event. Start with title, type, and quantity,
                  then adjust details in the table below.
                </p>

                <div className="planning-view__wp-add-bar-fields">
                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--title">
                    <span className="planning-view__wp-add-bar-label">Title</span>
                    <input
                      ref={addTitleRef}
                      className="input planning-view__wp-add-bar-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRow();
                        }
                      }}
                      placeholder="Work package title"
                      aria-label="New work package title"
                    />
                  </label>

                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--type">
                    <span className="planning-view__wp-add-bar-label" id={workTypeFieldLabelId}>
                      Type
                    </span>
                    <WorkTypePicker
                      workTypes={selectableWorkTypes}
                      selectedId={newWorkTypeId || null}
                      onChange={(id) => setNewWorkTypeId(id ?? '')}
                      disabled={selectableWorkTypes.length === 0}
                      emptyMessage="No work types. Add in Settings."
                      placeholder={
                        selectableWorkTypes.length === 0 ? 'No work types. Add in Settings.' : ''
                      }
                      showLabel={false}
                      inputClassName="planning-view__wp-add-bar-type"
                      inputAriaLabelledBy={workTypeFieldLabelId}
                    />
                  </label>

                  <label className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--qty">
                    <span className="planning-view__wp-add-bar-label">Quantity</span>
                    <input
                      className="input planning-view__wp-add-bar-qty"
                      type="number"
                      min={0.01}
                      step="any"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRow();
                        }
                      }}
                      placeholder="0"
                      aria-label="New work package quantity"
                    />
                  </label>

                  <div className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--unit">
                    <span className="planning-view__wp-add-bar-label">Unit</span>
                    <span className="planning-view__wp-add-bar-unit">
                      {newWorkType ? resolveWorkUnitLabel(newWorkType.workUnit) : '—'}
                    </span>
                  </div>

                  <div className="planning-view__wp-add-bar-field planning-view__wp-add-bar-field--action">
                    <span className="planning-view__wp-add-bar-label planning-view__wp-add-bar-label--sr-only">
                      Action
                    </span>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm planning-view__wp-add-bar-btn"
                      onClick={handleAddRow}
                      disabled={addDisabledReason != null}
                      title={addDisabledReason ?? 'Add work package'}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="planning-view__wp-add-mode planning-view__wp-add-mode--csv">
                <p className="planning-view__wp-add-bar-help">
                  Choose a CSV file with work package data (title, workTypeTitle, workUnit, phase, …)
                </p>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  Choose file
                </button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={onImportFileChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
