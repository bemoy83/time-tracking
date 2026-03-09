import { useEffect, useRef, useState } from 'react';
import { ActionSheet } from '../../../components/ActionSheet';
import {
  BlockedIcon,
  CheckIcon,
  PencilIcon,
  PlayIcon,
} from '../../../components/icons';
import type { BlockCategory, PlanLineItem } from '../../../lib/planning/plan-model';
import type { BuildPhase } from '../../../lib/types';
import type { FieldPlanLineItemSummary } from '../field-plan-model';
import type { FormMode } from '../field-plan-overlay-types';

const BLOCK_CATEGORIES: { value: BlockCategory; label: string }[] = [
  { value: 'access', label: 'Access' },
  { value: 'materials', label: 'Materials' },
  { value: 'crew', label: 'Crew' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'other', label: 'Other' },
];

interface FieldPlanActionSheetProps {
  formMode: FormMode | null;
  onClose: () => void;
  onSetFormMode: (formMode: FormMode | null) => void;
  onReleaseToToday: (lineItem: FieldPlanLineItemSummary) => void;
  onBlockSubmit: (lineItemId: string, phase: BuildPhase, reason: string, category: BlockCategory | null) => Promise<void>;
  onDeferSubmit: (lineItemId: string, phase: BuildPhase, note: string | null) => Promise<void>;
  onNoteSubmit: (lineItemId: string, phase: BuildPhase, note: string | null) => Promise<void>;
  onClearBlock: (lineItem: PlanLineItem, phase: BuildPhase) => Promise<void>;
  onReactivateDeferred: (lineItem: PlanLineItem, phase: BuildPhase) => Promise<void>;
}

export function FieldPlanActionSheet({
  formMode,
  onClose,
  onSetFormMode,
  onReleaseToToday,
  onBlockSubmit,
  onDeferSubmit,
  onNoteSubmit,
  onClearBlock,
  onReactivateDeferred,
}: FieldPlanActionSheetProps) {
  const sheetTitle = formMode
    ? formMode.kind === 'block' ? 'Mark Blocked'
      : formMode.kind === 'defer' ? 'Mark Deferred'
      : formMode.kind === 'note' ? 'Add Note'
      : formMode.lineItem.item.title
    : '';

  return (
    <ActionSheet
      isOpen={formMode !== null}
      onClose={onClose}
      title={sheetTitle}
    >
      {formMode?.kind === 'actions' && (
        <FieldPlanActionList
          lineItem={formMode.lineItem}
          onClose={onClose}
          onSetFormMode={onSetFormMode}
          onReleaseToToday={onReleaseToToday}
          onClearBlock={onClearBlock}
          onReactivateDeferred={onReactivateDeferred}
        />
      )}

      {formMode?.kind === 'block' && (
        <BlockForm
          lineItem={formMode.lineItem}
          onSubmit={(reason, category) => {
            void onBlockSubmit(formMode.lineItem.item.id, formMode.lineItem.phase, reason, category);
            onClose();
          }}
          onCancel={onClose}
        />
      )}

      {formMode?.kind === 'defer' && (
        <DeferForm
          lineItem={formMode.lineItem}
          onSubmit={(note) => {
            void onDeferSubmit(formMode.lineItem.item.id, formMode.lineItem.phase, note);
            onClose();
          }}
          onCancel={onClose}
        />
      )}

      {formMode?.kind === 'note' && (
        <NoteForm
          lineItem={formMode.lineItem}
          onSubmit={(note) => {
            void onNoteSubmit(formMode.lineItem.item.id, formMode.lineItem.phase, note);
            onClose();
          }}
          onCancel={onClose}
        />
      )}
    </ActionSheet>
  );
}

function FieldPlanActionList({
  lineItem,
  onClose,
  onSetFormMode,
  onReleaseToToday,
  onClearBlock,
  onReactivateDeferred,
}: {
  lineItem: FieldPlanLineItemSummary;
  onClose: () => void;
  onSetFormMode: (formMode: FormMode | null) => void;
  onReleaseToToday: (lineItem: FieldPlanLineItemSummary) => void;
  onClearBlock: (lineItem: PlanLineItem, phase: BuildPhase) => Promise<void>;
  onReactivateDeferred: (lineItem: PlanLineItem, phase: BuildPhase) => Promise<void>;
}) {
  return (
    <div className="field-plan__action-list">
      {lineItem.status === 'pending' && lineItem.tasks.length === 0 && (
        <button
          type="button"
          className="field-plan__action-btn"
          onClick={() => {
            onReleaseToToday(lineItem);
            onClose();
          }}
        >
          <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
          <span>Release to Today</span>
        </button>
      )}

      {lineItem.status !== 'completed' && lineItem.status !== 'blocked' && (
        <button
          type="button"
          className="field-plan__action-btn"
          onClick={() => onSetFormMode({ kind: 'block', lineItem })}
        >
          <BlockedIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--warning" />
          <span>Mark Blocked</span>
        </button>
      )}

      {(lineItem.status === 'pending' || lineItem.status === 'blocked') && (
        <button
          type="button"
          className="field-plan__action-btn"
          onClick={() => onSetFormMode({ kind: 'defer', lineItem })}
        >
          <span className="field-plan__action-btn-icon field-plan__action-btn-icon--muted">-</span>
          <span>Mark Deferred</span>
        </button>
      )}

      {lineItem.status === 'blocked' && (
        <button
          type="button"
          className="field-plan__action-btn"
          onClick={() => {
            void onClearBlock(lineItem.item, lineItem.phase);
            onClose();
          }}
        >
          <CheckIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--ready" />
          <span>Clear Block</span>
        </button>
      )}

      {lineItem.status === 'deferred' && (
        <button
          type="button"
          className="field-plan__action-btn"
          onClick={() => {
            void onReactivateDeferred(lineItem.item, lineItem.phase);
            onClose();
          }}
        >
          <PlayIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--primary" />
          <span>Reactivate</span>
        </button>
      )}

      <button
        type="button"
        className="field-plan__action-btn"
        onClick={() => onSetFormMode({ kind: 'note', lineItem })}
      >
        <PencilIcon className="field-plan__action-btn-icon field-plan__action-btn-icon--muted" />
        <span>Add Note</span>
      </button>
    </div>
  );
}

function BlockForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: FieldPlanLineItemSummary;
  onSubmit: (reason: string, category: BlockCategory | null) => void;
  onCancel: () => void;
}) {
  const pf = lineItem.phaseFields;
  const [reason, setReason] = useState(pf.blockReason ?? '');
  const [category, setCategory] = useState<BlockCategory | null>(pf.blockCategory ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSubmit = reason.trim().length > 0;

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="block-reason">Reason</label>
        <input
          ref={inputRef}
          id="block-reason"
          className="input"
          type="text"
          placeholder="What's blocking this?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label">Category</label>
        <div className="field-plan__category-pills" role="radiogroup" aria-label="Block category">
          {BLOCK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={`field-plan__category-pill${category === cat.value ? ' field-plan__category-pill--active' : ''}`}
              onClick={() => setCategory(category === cat.value ? null : cat.value)}
              role="radio"
              aria-checked={category === cat.value}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--warning btn--lg"
            onClick={() => canSubmit && onSubmit(reason.trim(), category)}
            disabled={!canSubmit}
          >
            Block
          </button>
        </div>
      </div>
    </>
  );
}

function DeferForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: FieldPlanLineItemSummary;
  onSubmit: (note: string | null) => void;
  onCancel: () => void;
}) {
  const pf = lineItem.phaseFields;
  const [note, setNote] = useState(pf.deferredNote ?? '');

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="defer-note">Note (optional)</label>
        <input
          id="defer-note"
          className="input"
          type="text"
          placeholder="Why is this deferred?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => onSubmit(note.trim() || null)}
          >
            Defer
          </button>
        </div>
      </div>
    </>
  );
}

function NoteForm({
  lineItem,
  onSubmit,
  onCancel,
}: {
  lineItem: FieldPlanLineItemSummary;
  onSubmit: (note: string | null) => void;
  onCancel: () => void;
}) {
  const pf = lineItem.phaseFields;
  const [note, setNote] = useState(pf.executorNote ?? '');

  return (
    <>
      <div className="field-plan__form-group">
        <label className="field-plan__form-label" htmlFor="executor-note">Note</label>
        <input
          id="executor-note"
          className="input"
          type="text"
          placeholder="Add a note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </div>
      <div className="action-sheet__actions">
        <div className="action-sheet__actions-right">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => onSubmit(note.trim() || null)}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
