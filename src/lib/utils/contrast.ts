/**
 * Returns 'white' or 'black' based on the relative luminance of the given hex color.
 * Uses WCAG 2.0 relative luminance formula.
 */
export function getContrastColor(hex: string): 'white' | 'black' {
  // Remove # prefix
  const raw = hex.replace(/^#/, '');
  const r = parseInt(raw.substring(0, 2), 16) / 255;
  const g = parseInt(raw.substring(2, 4), 16) / 255;
  const b = parseInt(raw.substring(4, 6), 16) / 255;

  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.179 ? 'black' : 'white';
}
