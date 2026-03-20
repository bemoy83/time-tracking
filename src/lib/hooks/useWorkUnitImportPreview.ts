import { useEffect, useMemo, useState } from 'react';
import type { WorkUnitDefinition } from '../types';
import {
  buildWorkUnitImportPreview,
  type ImportedWorkUnitReference,
  type WorkUnitImportPreview,
} from '../interop/work-unit-import-preview';

export interface UnitImportPreviewState {
  preview: WorkUnitImportPreview | null;
  applyImportedLabels: boolean;
  setApplyImportedLabels: (value: boolean) => void;
}

export function useWorkUnitImportPreview(
  items: ImportedWorkUnitReference[] | null | undefined,
  definitions: WorkUnitDefinition[],
): UnitImportPreviewState {
  const [applyImportedLabels, setApplyImportedLabels] = useState(false);
  const preview = useMemo(
    () => (items ? buildWorkUnitImportPreview(items, definitions) : null),
    [definitions, items],
  );

  useEffect(() => {
    setApplyImportedLabels(false);
  }, [items]);

  return {
    preview,
    applyImportedLabels,
    setApplyImportedLabels,
  };
}
