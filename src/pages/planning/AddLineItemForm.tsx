import { useRef, useState, useEffect, useMemo } from 'react';
import {
  formatWorkTypeWithUnit,
  resolveWorkUnitLabel,
} from '../../lib/types';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
  createLineItem,
} from '../../lib/planning/plan-model';

/** Select all text on focus so typing replaces the value. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

interface AddLineItemFormProps {
  onAdd: (item: PlanLineItem) => void;
  onCancel?: () => void;
}

export function AddLineItemForm({ onAdd, onCancel }: AddLineItemFormProps) {
  const { workTypes } = useWorkTypeStore();
  const filteredWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
  const [workQuantity, setWorkQuantity] = useState(0);
  const [rate, setRate] = useState(10);

  useEffect(() => {
    if (filteredWorkTypes.length === 0) {
      if (selectedWorkTypeId) {
        setSelectedWorkTypeId('');
      }
      return;
    }
    const isCurrentSelectionValid = filteredWorkTypes.some((wt) => wt.id === selectedWorkTypeId);
    if (!isCurrentSelectionValid) {
      setSelectedWorkTypeId(filteredWorkTypes[0].id);
      setRate(filteredWorkTypes[0].assemblyRate || filteredWorkTypes[0].dismantleRate);
    }
  }, [filteredWorkTypes, selectedWorkTypeId]);

  const selectedWorkType = selectedWorkTypeId
    ? filteredWorkTypes.find((wt) => wt.id === selectedWorkTypeId) ?? null
    : null;

  const handleWorkTypeChange = (wtId: string) => {
    setSelectedWorkTypeId(wtId);
    const wt = filteredWorkTypes.find((candidate) => candidate.id === wtId);
    if (wt) {
      setRate(wt.assemblyRate || wt.dismantleRate);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !selectedWorkType) return;
    const item = createLineItem(
      title.trim(),
      selectedWorkType.title,
      selectedWorkType.workUnit,
      workQuantity,
      rate,
      selectedWorkType.dismantleRate || rate,
      'template',
      selectedWorkType.id,
    );
    onAdd(item);
    setTitle('');
    setWorkQuantity(0);
    titleRef.current?.focus();
  };

  const noWorkTypesMessage = 'No work types. Add work types in Settings.';

  return (
    <div className="planning-view__line-item planning-view__line-item--add">
      <div className="planning-view__add-fields">
        <div className="planning-view__field">
          <span className="planning-view__field-label">Title</span>
          <input
            ref={titleRef}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Install drywall"
          />
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">Work Type</span>
          <select
            className="input"
            value={selectedWorkTypeId}
            disabled={filteredWorkTypes.length === 0}
            onChange={(e) => handleWorkTypeChange(e.target.value)}
          >
            {filteredWorkTypes.length === 0 && <option value="">{noWorkTypesMessage}</option>}
            {filteredWorkTypes.map((wt) => (
              <option key={wt.id} value={wt.id}>
                {formatWorkTypeWithUnit(wt.title, wt.workUnit)}
              </option>
            ))}
          </select>
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">
            Qty{selectedWorkType ? ` (${resolveWorkUnitLabel(selectedWorkType.workUnit)})` : ''}
          </span>
          <input
            className="input"
            type="number"
            value={workQuantity}
            onChange={(e) => setWorkQuantity(Number(e.target.value))}
            onFocus={selectOnFocus}
          />
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">
            Rate{selectedWorkType ? ` (${resolveWorkUnitLabel(selectedWorkType.workUnit)}/ph)` : ''}
          </span>
          <input
            className="input"
            type="number"
            value={rate}
            step={0.1}
            onChange={(e) => setRate(Number(e.target.value))}
            onFocus={selectOnFocus}
          />
        </div>
        <button
          className="btn btn--primary planning-view__add-action-btn"
          onClick={handleSubmit}
          disabled={!title.trim() || !selectedWorkType}
          aria-label="Add work package"
          title="Add work package"
        >
          +
        </button>
        {onCancel && (
          <button
            className="btn btn--secondary btn--sm planning-view__add-action-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
