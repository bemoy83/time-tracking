/**
 * Normalize a number string for parsing with Number().
 * Accepts both US format (1,234.56) and European format (1.234,56 or 11,5).
 *
 * Rule: the rightmost . or , is the decimal separator; the other (if any) is thousands.
 * Spaces (used as thousands in some locales) are stripped.
 */

export function normalizeNumberString(value: string): string {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return value.trim();

  const lastComma = trimmed.lastIndexOf(',');
  const lastPeriod = trimmed.lastIndexOf('.');

  if (lastComma === -1 && lastPeriod === -1) return trimmed;

  if (lastComma === -1) {
    // Only period: "11.5" (US decimal) or "1.234" (EU thousands)
    const afterPeriod = trimmed.slice(lastPeriod + 1);
    if (/^\d{3}(?:\d{3})*$/.test(afterPeriod)) {
      return trimmed.replace(/\./g, '');
    }
    return trimmed;
  }

  if (lastPeriod === -1) {
    // Only comma: "11,5" (EU decimal) or "1,234" (US thousands)
    const afterComma = trimmed.slice(lastComma + 1);
    if (/^\d{3}(?:\d{3})*$/.test(afterComma)) {
      return trimmed.replace(/,/g, '');
    }
    return trimmed.replace(',', '.');
  }

  // Both present: rightmost is decimal separator
  if (lastComma > lastPeriod) {
    return trimmed.replace(/\./g, '').replace(',', '.');
  }
  return trimmed.replace(/,/g, '');
}
