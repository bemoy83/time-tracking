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

  useEffect(() => {
    if (newWorkTypeId === '') return;
    if (selectableWorkTypes.length === 0) {
      setNewWorkTypeId('');
      return;
    }
    const isCurrentValid = selectableWorkTypes.some((wt) => wt.id === newWorkTypeId);
    if (!isCurrentValid) setNewWorkTypeId('');
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
              onClick={() => { void onImportConfirm(); }}
              disabled={isImportApplying}
            >
              Confirm
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onImportCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <input
              ref={addTitleRef}
              className="input planning-view__wp-add-bar-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddRow(); }
              }}
              placeholder="New work package…"
              aria-label="New work package title"
            />

            <span id={workTypeFieldLabelId} className="sr-only">Work type</span>
            <WorkTypePicker
              workTypes={selectableWorkTypes}
              selectedId={newWorkTypeId || null}
              onChange={(id) => setNewWorkTypeId(id ?? '')}
              disabled={selectableWorkTypes.length === 0}
              emptyMessage="No work types available"
              placeholder={selectableWorkTypes.length === 0 ? 'No work types available' : 'Work type…'}
              showLabel={false}
              inputClassName="planning-view__wp-add-bar-type"
              inputAriaLabelledBy={workTypeFieldLabelId}
            />

            <input
              className="input planning-view__wp-add-bar-qty"
              type="number"
              min={0.01}
              step="any"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddRow(); }
              }}
              placeholder="Qty"
              aria-label="New work package quantity"
            />

            <span className="planning-view__wp-add-bar-unit" aria-hidden>
              {newWorkType ? resolveWorkUnitLabel(newWorkType.workUnit) : '—'}
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

            <span className="planning-view__wp-add-bar-sep" aria-hidden>·</span>

            <button
              type="button"
              className="btn btn--ghost btn--sm planning-view__wp-add-bar-import-btn"
              onClick={() => importFileInputRef.current?.click()}
              title="Import work packages from CSV"
            >
              Import CSV
            </button>

            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={onImportFileChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
