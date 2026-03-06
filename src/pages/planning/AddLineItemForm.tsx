import { useRef, useState, useEffect, useMemo } from 'react';
import {
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  type BuildPhase,
} from '../../lib/types';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
  createLineItem,
} from '../../lib/planning/plan-model';

/** Select all text on focus so typing replaces the value. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

interface AddLineItemFormProps {
  phaseFilter: BuildPhase;
  onAdd: (item: PlanLineItem) => void;
  onCancel?: () => void;
}

export function AddLineItemForm({ phaseFilter, onAdd, onCancel }: AddLineItemFormProps) {
  const { workTypes } = useWorkTypeStore();
  const filteredWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.buildPhase === phaseFilter),
    [workTypes, phaseFilter],
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
      setRate(filteredWorkTypes[0].expectedProductivity);
    }
  }, [filteredWorkTypes, selectedWorkTypeId]);

  const selectedWorkType = selectedWorkTypeId
    ? filteredWorkTypes.find((wt) => wt.id === selectedWorkTypeId) ?? null
    : null;

  const handleWorkTypeChange = (wtId: string) => {
    setSelectedWorkTypeId(wtId);
    const wt = filteredWorkTypes.find((candidate) => candidate.id === wtId);
    if (wt) {
      setRate(wt.expectedProductivity);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !selectedWorkType) return;
    const item = createLineItem(
      title.trim(),
      selectedWorkType.title,
      selectedWorkType.workUnit,
      selectedWorkType.buildPhase,
      workQuantity,
      rate,
      'template',
      selectedWorkType.id,
    );
    onAdd(item);
    setTitle('');
    setWorkQuantity(0);
    titleRef.current?.focus();
  };

  const noWorkTypesMessage = `No work types for ${BUILD_PHASE_LABELS[phaseFilter]}. Add work types in Settings.`;

  return (
    <div className="planning-view__line-item planning-view__line-item--add">
      <h3 className="planning-view__add-form-title">Add Work Package</h3>
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
                {wt.title} · {BUILD_PHASE_LABELS[wt.buildPhase]} · {WORK_UNIT_LABELS[wt.workUnit]}
              </option>
            ))}
          </select>
        </div>
        <div className="planning-view__field">
          <span className="planning-view__field-label">
            Quantity{selectedWorkType ? ` (${WORK_UNIT_LABELS[selectedWorkType.workUnit]})` : ''}
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
            Rate{selectedWorkType ? ` (${WORK_UNIT_LABELS[selectedWorkType.workUnit]}/ph)` : ''}
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
      </div>
      <div className="planning-view__add-actions">
        {onCancel && <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>}
        <button
          className="btn btn--primary"
          onClick={handleSubmit}
          disabled={!title.trim() || !selectedWorkType}
        >
          Add
        </button>
      </div>
    </div>
  );
}
