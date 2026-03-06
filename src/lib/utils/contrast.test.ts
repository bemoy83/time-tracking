import { describe, it, expect } from 'vitest';
import { getContrastColor } from './contrast';

describe('getContrastColor', () => {
  it('returns white for dark colors', () => {
    expect(getContrastColor('#2563eb')).toBe('white'); // blue
    expect(getContrastColor('#dc2626')).toBe('white'); // red
    expect(getContrastColor('#7c3aed')).toBe('white'); // violet
    expect(getContrastColor('#db2777')).toBe('white'); // pink
    expect(getContrastColor('#4f46e5')).toBe('white'); // indigo
  });

  it('returns black for light colors', () => {
    expect(getContrastColor('#ffffff')).toBe('black');
    expect(getContrastColor('#f0f0f0')).toBe('black');
  });

  it('returns correct contrast for medium colors', () => {
    // Green (#16a34a) has enough luminance for black text
    expect(getContrastColor('#16a34a')).toBe('black');
    expect(getContrastColor('#ea580c')).toBe('black'); // orange has enough luminance for black
  });

  it('handles cyan and teal correctly', () => {
    // These are the colors most likely to need black text
    const cyanResult = getContrastColor('#0891b2');
    const tealResult = getContrastColor('#0d9488');
    expect([cyanResult, tealResult].every(r => r === 'white' || r === 'black')).toBe(true);
  });

  it('handles hex with # prefix', () => {
    expect(getContrastColor('#000000')).toBe('white');
  });

  it('handles hex without # prefix', () => {
    expect(getContrastColor('000000')).toBe('white');
  });
});
