import { describe, expect, it } from 'vitest';
import {
  assertSupportedTransferSchemaVersion,
  assertTransferExportType,
  createTransferEnvelope,
  DATA_TRANSFER_APP_VERSION,
  parseJsonRecord,
} from './transfer-core';

describe('transfer-core', () => {
  it('creates envelopes with shared defaults', () => {
    const envelope = createTransferEnvelope(
      'full-backup',
      { ok: true },
      '2026-03-22T10:00:00.000Z',
    );

    expect(envelope).toEqual({
      schemaVersion: '4.0',
      exportType: 'full-backup',
      exportedAt: '2026-03-22T10:00:00.000Z',
      appVersion: DATA_TRANSFER_APP_VERSION,
      payload: { ok: true },
    });
  });

  it('parses a top-level JSON record', () => {
    expect(parseJsonRecord('{"a":1}')).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it('rejects invalid JSON and non-record structures', () => {
    expect(parseJsonRecord('{')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parseJsonRecord('[]')).toEqual({ ok: false, error: 'invalid-structure' });
  });

  it('checks export type and schema support', () => {
    expect(assertTransferExportType({ exportType: 'plan-package' }, 'plan-package')).toBe(true);
    expect(assertTransferExportType({ exportType: 'full-backup' }, 'execution-return')).toBe(false);
    expect(assertSupportedTransferSchemaVersion('4.0', 'full-backup')).toEqual({ ok: true });
    expect(assertSupportedTransferSchemaVersion('9.0', 'full-backup')).toEqual({
      ok: false,
      error: 'Unsupported full-backup schema version: 9.0. Only schema 3.0, 4.0 is supported.',
    });
  });
});
