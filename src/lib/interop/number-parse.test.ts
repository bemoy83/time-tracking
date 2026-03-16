import { describe, expect, it } from 'vitest';
import { normalizeNumberString } from './number-parse';

describe('normalizeNumberString', () => {
  it('accepts US decimal format', () => {
    expect(Number(normalizeNumberString('11.5'))).toBe(11.5);
    expect(Number(normalizeNumberString('0.5'))).toBe(0.5);
    expect(Number(normalizeNumberString('1.2'))).toBe(1.2);
  });

  it('accepts European decimal format', () => {
    expect(Number(normalizeNumberString('11,5'))).toBe(11.5);
    expect(Number(normalizeNumberString('0,5'))).toBe(0.5);
    expect(Number(normalizeNumberString('12,34'))).toBe(12.34);
  });

  it('accepts US thousands with decimal', () => {
    expect(Number(normalizeNumberString('1,234.56'))).toBe(1234.56);
    expect(Number(normalizeNumberString('12,345.67'))).toBe(12345.67);
  });

  it('accepts European thousands with decimal', () => {
    expect(Number(normalizeNumberString('1.234,56'))).toBe(1234.56);
    expect(Number(normalizeNumberString('12.345,67'))).toBe(12345.67);
  });

  it('accepts integers without separators', () => {
    expect(Number(normalizeNumberString('10'))).toBe(10);
    expect(Number(normalizeNumberString('1234'))).toBe(1234);
  });

  it('accepts European thousands (period) for integers', () => {
    expect(Number(normalizeNumberString('1.234'))).toBe(1234);
    expect(Number(normalizeNumberString('12.345'))).toBe(12345);
  });

  it('accepts US thousands (comma) for integers', () => {
    expect(Number(normalizeNumberString('1,234'))).toBe(1234);
    expect(Number(normalizeNumberString('12,345'))).toBe(12345);
  });

  it('strips spaces used as thousands', () => {
    expect(Number(normalizeNumberString('1 234,56'))).toBe(1234.56);
    expect(Number(normalizeNumberString('1 234.56'))).toBe(1234.56);
  });

  it('returns trimmed value for empty or whitespace-only', () => {
    expect(normalizeNumberString('')).toBe('');
    expect(normalizeNumberString('   ')).toBe('');
  });
});
