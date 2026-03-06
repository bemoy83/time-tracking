import type { ConfidenceLevel } from '../../lib/kpi';
import type { SolveFor } from '../../lib/calculator';
import type { WorkUnit } from '../../lib/types';

export type ProductivitySource = 'template' | 'historical' | 'manual';

export interface RateInfo {
  rate: number;
  source: 'template' | 'historical';
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
  cv: number | null;
  templateName: string | null;
}

export interface CalcResult {
  type: SolveFor;
  crewValue?: number;
  crewExact?: number;
  timeFormatted?: string;
  timeHours?: number;
  rateUsed: number;
  rateSource: ProductivitySource;
  quantityUsed: number;
  unitUsed: WorkUnit;
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
}
