import { openDB } from 'idb';
import type { TimeTrackingDBSchema } from '../schema';

type OpenDbOptions = NonNullable<Parameters<typeof openDB<TimeTrackingDBSchema>>[2]>;
type LibraryDbUpgradeCallback = NonNullable<OpenDbOptions['upgrade']>;
type StoreKey = Extract<keyof TimeTrackingDBSchema, string>;

export type DbUpgradeCallback = (
  ...args: Parameters<LibraryDbUpgradeCallback>
) => void | Promise<void>;

export type MigrationDb = Parameters<LibraryDbUpgradeCallback>[0];
export type MigrationTransaction = Parameters<LibraryDbUpgradeCallback>[3];

export interface MigrationContext {
  db: MigrationDb;
  oldVersion: number;
  transaction: MigrationTransaction;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return formatLocalDate(value);
}

export function listDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function accessHoursForDay(day: Record<string, unknown> | undefined): number {
  const start = typeof day?.accessStart === 'string' ? day.accessStart : null;
  const end = typeof day?.accessEnd === 'string' ? day.accessEnd : null;
  if (!start || !end) return 8;
  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  if (startParts.length !== 2 || endParts.length !== 2) return 8;
  const hours = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
  return Number.isFinite(hours) && hours > 0 ? hours : 8;
}

export function renameField(record: Record<string, unknown>, from: string, to: string): boolean {
  if (!(from in record) || to in record) return false;
  record[to] = record[from];
  delete record[from];
  return true;
}

export async function backfillStore<StoreName extends StoreKey>(
  transaction: MigrationTransaction,
  storeName: StoreName,
  mutate: (record: TimeTrackingDBSchema[StoreName]['value'], index: number) => boolean,
): Promise<void> {
  const store = transaction.objectStore(storeName as never);
  const records = await store.getAll();

  for (const [index, record] of records.entries()) {
    if (mutate(record, index)) {
      await store.put(record);
    }
  }
}
