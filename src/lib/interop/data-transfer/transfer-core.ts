import { nowUtc } from '../../types';
import {
  DATA_TRANSFER_SCHEMA_VERSION,
  type DataTransferEnvelope,
  type DataTransferExportType,
} from './contracts';
import {
  isSupportedSchemaVersion,
  unsupportedSchemaVersionMessage,
} from './schema-version';

export const DATA_TRANSFER_APP_VERSION = '0.0.1';

export type ParseJsonRecordResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: 'invalid-json' | 'invalid-structure' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function createTransferEnvelope<
  TPayload,
  TExportType extends DataTransferExportType,
>(
  exportType: TExportType,
  payload: TPayload,
  exportedAt: string = nowUtc(),
): DataTransferEnvelope<TPayload> {
  return {
    schemaVersion: DATA_TRANSFER_SCHEMA_VERSION,
    exportType,
    exportedAt,
    appVersion: DATA_TRANSFER_APP_VERSION,
    payload,
  };
}

export function parseJsonRecord(text: string): ParseJsonRecordResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, error: 'invalid-structure' };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
}

export function assertTransferExportType(
  parsed: Record<string, unknown>,
  exportType: DataTransferExportType,
): boolean {
  return parsed.exportType === exportType;
}

export function assertSupportedTransferSchemaVersion(
  schemaVersion: string,
  exportType: DataTransferExportType,
): { ok: true } | { ok: false; error: string } {
  if (isSupportedSchemaVersion(schemaVersion)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: unsupportedSchemaVersionMessage(schemaVersion, exportType),
  };
}
