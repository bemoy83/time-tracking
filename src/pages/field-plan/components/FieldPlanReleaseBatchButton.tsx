import { useMemo, useState } from 'react';
import { AlertDialog } from '../../../components/AlertDialog';
import { PlayIcon } from '../../../components/icons';
import { isLineItemEligibleForRelease, type FieldPlanLineItemSummary } from '../field-plan-model';

interface FieldPlanReleaseBatchButtonProps {
  lineItems: FieldPlanLineItemSummary[];
  onReleaseBatch: (eligible: FieldPlanLineItemSummary[]) => void;
  /** Shown in the confirmation copy, e.g. "Assembly" or "Pending". */
  scopeLabel: string;
}

export function FieldPlanReleaseBatchButton({
  lineItems,
  onReleaseBatch,
  scopeLabel,
}: FieldPlanReleaseBatchButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const eligible = useMemo(
    () => lineItems.filter(isLineItemEligibleForRelease),
    [lineItems],
  );

  if (eligible.length === 0) return null;

  const confirmRelease = () => {
    onReleaseBatch(eligible);
    setDialogOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => setDialogOpen(true)}
        aria-label={`Release all eligible in ${scopeLabel}`}
      >
        <PlayIcon className="field-plan__release-batch-icon" aria-hidden />
        Release all
      </button>

      <AlertDialog
        isOpen={dialogOpen}
        title="Release work packages?"
        description={`This will create ${eligible.length} task${eligible.length === 1 ? '' : 's'} for eligible work packages in ${scopeLabel}.`}
        onClose={() => setDialogOpen(false)}
        actions={[
          {
            label: 'Cancel',
            onClick: () => setDialogOpen(false),
            variant: 'secondary',
          },
          {
            label: 'Release',
            onClick: confirmRelease,
            variant: 'primary',
          },
        ]}
      />
    </>
  );
}
