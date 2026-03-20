import type { WorkUnit } from './work-units';
import { resolveWorkUnitLabel } from './work-units';

export function formatQuantityWithUnit(
  quantity: number | string,
  unit: WorkUnit | string | null | undefined,
): string {
  const label = resolveWorkUnitLabel(unit);
  return label ? `${quantity} ${label}` : String(quantity);
}

export function formatWorkTypeWithUnit(
  title: string,
  unit: WorkUnit | string | null | undefined,
): string {
  const label = resolveWorkUnitLabel(unit);
  return label ? `${title} · ${label}` : title;
}

export function formatUnitRate(
  rate: number | string,
  unit: WorkUnit | string | null | undefined,
  per: string = 'ph',
): string {
  const label = resolveWorkUnitLabel(unit);
  return label ? `${rate} ${label}/${per}` : String(rate);
}
