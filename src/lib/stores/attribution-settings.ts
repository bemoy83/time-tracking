/**
 * Attribution policy setting — localStorage-backed.
 * Default: 'soft_allow_flag' (heuristics suggest only, no behavior change).
 */

import type { AttributionPolicy } from '../types';
import { DEFAULT_ATTRIBUTION_POLICY } from '../types';

const POLICY_KEY = 'attributionPolicy';

const VALID_POLICIES: AttributionPolicy[] = [
  'soft_allow_flag',
  'strict_block',
  'soft_allow_pick_nearest',
];

export function getAttributionPolicy(): AttributionPolicy {
  try {
    const stored = localStorage.getItem(POLICY_KEY);
    if (stored && VALID_POLICIES.includes(stored as AttributionPolicy)) {
      return stored as AttributionPolicy;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ATTRIBUTION_POLICY;
}

export function setAttributionPolicy(policy: AttributionPolicy): void {
  try {
    localStorage.setItem(POLICY_KEY, policy);
  } catch {
    // ignore
  }
}
