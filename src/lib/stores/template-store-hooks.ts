/**
 * React hooks for the template store.
 */

import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot } from './template-store';

export function useTemplateStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
