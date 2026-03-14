import {
  DATA_TRANSFER_SCHEMA_COMPAT,
  type DataTransferExportType,
} from './contracts';

export function isSupportedSchemaVersion(schemaVersion: string): boolean {
  return DATA_TRANSFER_SCHEMA_COMPAT.includes(
    schemaVersion as (typeof DATA_TRANSFER_SCHEMA_COMPAT)[number],
  );
}

export function unsupportedSchemaVersionMessage(
  schemaVersion: string,
  exportType: DataTransferExportType,
): string {
  return `Unsupported ${exportType} schema version: ${schemaVersion}. Only schema ${DATA_TRANSFER_SCHEMA_COMPAT.join(', ')} is supported.`;
}
