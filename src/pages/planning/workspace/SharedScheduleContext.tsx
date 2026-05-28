import { createContext, useContext } from 'react';

export interface SharedScheduleContextValue {
  crewPoolDefaultCrewSize: number;
  onDefaultCrewSizeChange: (value: string) => void;
}

export const SharedScheduleContext = createContext<SharedScheduleContextValue | null>(null);

export function useSharedScheduleContext(): SharedScheduleContextValue | null {
  return useContext(SharedScheduleContext);
}
