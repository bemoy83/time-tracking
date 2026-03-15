import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export function lazyNamedExport<TModule, TKey extends keyof TModule>(
  factory: () => Promise<TModule>,
  key: TKey,
): LazyExoticComponent<Extract<TModule[TKey], ComponentType<any>>> {
  return lazy(async () => {
    const module = await factory();
    return {
      default: module[key] as Extract<TModule[TKey], ComponentType<any>>,
    };
  });
}
