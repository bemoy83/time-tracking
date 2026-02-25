import { useState } from 'react';
import { downloadCsv } from '../../../../lib/interop/download-csv';
import { exportWorkTypesCsv } from '../../../../lib/interop/work-type-export';
import {
  applyWorkTypeImport,
  generateWorkTypeImportPreview,
  parseWorkTypeCsv,
  type WorkTypeImportPreview,
} from '../../../../lib/interop/work-type-import';
import type { WorkType } from '../../../../lib/types';

interface UseInteropWorkTypeInteropOptions {
  workTypes: WorkType[];
}

export function useInteropWorkTypeInterop({ workTypes }: UseInteropWorkTypeInteropOptions) {
  const [isExportingWorkTypes, setIsExportingWorkTypes] = useState(false);
  const [workTypeCsvInput, setWorkTypeCsvInput] = useState('');
  const [workTypeParseErrors, setWorkTypeParseErrors] = useState<string[]>([]);
  const [workTypePreview, setWorkTypePreview] = useState<WorkTypeImportPreview | null>(null);
  const [isApplyingWorkTypeImport, setIsApplyingWorkTypeImport] = useState(false);
  const [workTypeExportSummary, setWorkTypeExportSummary] = useState<string | null>(null);
  const [workTypeImportSummary, setWorkTypeImportSummary] = useState<string | null>(null);

  const handleWorkTypeExport = () => {
    setIsExportingWorkTypes(true);
    try {
      const csv = exportWorkTypesCsv(workTypes);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`work-types-${stamp}.csv`, csv);
      setWorkTypeExportSummary(`Exported ${workTypes.length} work type definitions.`);
    } finally {
      setIsExportingWorkTypes(false);
    }
  };

  const handleParseWorkTypeImport = () => {
    const parsed = parseWorkTypeCsv(workTypeCsvInput);
    if (!parsed.valid) {
      setWorkTypePreview(null);
      setWorkTypeParseErrors(parsed.errors.map((error) => `Row ${error.row}: ${error.field} - ${error.message}`));
      return;
    }

    setWorkTypeParseErrors([]);
    setWorkTypeImportSummary(null);
    setWorkTypePreview(generateWorkTypeImportPreview(parsed.items, workTypes));
  };

  const handleApplyWorkTypeImport = async () => {
    if (!workTypePreview) return;

    setIsApplyingWorkTypeImport(true);
    try {
      const result = await applyWorkTypeImport(workTypePreview.items.map((item) => item.item));
      setWorkTypeImportSummary(`Applied import: ${result.created} created, ${result.updated} updated.`);
      setWorkTypePreview(null);
      setWorkTypeCsvInput('');
      setWorkTypeParseErrors([]);
    } finally {
      setIsApplyingWorkTypeImport(false);
    }
  };

  return {
    isExportingWorkTypes,
    workTypeCsvInput,
    setWorkTypeCsvInput,
    workTypeParseErrors,
    workTypePreview,
    isApplyingWorkTypeImport,
    workTypeExportSummary,
    workTypeImportSummary,
    handleWorkTypeExport,
    handleParseWorkTypeImport,
    handleApplyWorkTypeImport,
  };
}
