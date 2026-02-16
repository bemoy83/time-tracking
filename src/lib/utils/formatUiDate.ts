/**
 * Formats ISO timestamps for UI labels.
 */
export function formatUiDate(
  isoDate: string,
  mode: 'relative' | 'short',
  locale = 'en-US'
): string {
  const date = new Date(isoDate);

  if (mode === 'short') {
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  }

  const now = Date.now();
  const then = date.getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(locale);
}
