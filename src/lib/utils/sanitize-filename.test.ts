import { describe, expect, it } from 'vitest';
import { sanitizeFileNameSegment } from './sanitize-filename';

describe('sanitizeFileNameSegment', () => {
  it('normalizes spaces and punctuation to kebab-case', () => {
    expect(sanitizeFileNameSegment('  Spring Event / Hall A  ')).toBe('spring-event-hall-a');
  });

  it('falls back to plan when input has no allowed characters', () => {
    expect(sanitizeFileNameSegment('***')).toBe('plan');
  });
});
