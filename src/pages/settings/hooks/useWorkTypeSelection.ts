import { useState } from 'react';
import type { WorkType } from '../../../lib/types';
import { removeWorkType } from '../../../lib/stores/work-type-store';

interface WorkTypeSelectionState {
  selectionMode: boolean;
  selectedIds: string[];
  showBulkConfirm: boolean;
  isBulkDeleting: boolean;
  visibleAllSelected: boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSelected: (id: string) => void;
  selectAllVisible: () => void;
  openBulkConfirm: () => void;
  closeBulkConfirm: () => void;
  handleBulkDeleteConfirmed: () => Promise<void>;
}

export function useWorkTypeSelection(displayedWorkTypes: WorkType[]): WorkTypeSelectionState {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds([]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    const visibleIds = displayedWorkTypes.map((wt) => wt.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  const visibleAllSelected =
    displayedWorkTypes.length > 0 &&
    displayedWorkTypes.every((wt) => selectedIds.includes(wt.id));

  async function handleBulkDeleteConfirmed() {
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => removeWorkType(id)));
    } finally {
      setIsBulkDeleting(false);
      setShowBulkConfirm(false);
      exitSelectionMode();
    }
  }

  return {
    selectionMode,
    selectedIds,
    showBulkConfirm,
    isBulkDeleting,
    visibleAllSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelected,
    selectAllVisible,
    openBulkConfirm: () => setShowBulkConfirm(true),
    closeBulkConfirm: () => setShowBulkConfirm(false),
    handleBulkDeleteConfirmed,
  };
}
