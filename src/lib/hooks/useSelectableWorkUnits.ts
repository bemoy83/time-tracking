import { useMemo } from 'react';
import { useWorkUnitStore } from '../stores/work-unit-store';
import { getDefaultWorkUnitIdFromDefinitions, getSelectableWorkUnitDefinitionsFromList } from '../work-unit-domain';

export function useSelectableWorkUnits(currentUnitId: string | null | undefined = null) {
  const { definitions } = useWorkUnitStore();

  return useMemo(() => {
    const selectableUnits = getSelectableWorkUnitDefinitionsFromList(definitions, currentUnitId);
    return {
      selectableUnits,
      defaultUnitId: getDefaultWorkUnitIdFromDefinitions(definitions),
    };
  }, [currentUnitId, definitions]);
}
