/**
 * Formats count + noun with basic pluralization.
 * Example: pluralize(2, 'task') => "2 tasks"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
