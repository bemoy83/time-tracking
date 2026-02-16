/**
 * ProjectColorPicker component.
 * Color swatch grid for selecting a project color.
 */

import { PROJECT_COLORS } from '../lib/types';

interface ProjectColorPickerProps {
  colors?: readonly string[];
  value: string;
  onChange: (color: string) => void;
  ariaLabelPrefix?: string;
}

export function ProjectColorPicker({
  colors = PROJECT_COLORS,
  value,
  onChange,
  ariaLabelPrefix = 'Select color',
}: ProjectColorPickerProps) {
  return (
    <div className="project-color-picker">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`project-color-picker__swatch ${
            value === color ? 'project-color-picker__swatch--selected' : ''
          }`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={`${ariaLabelPrefix} ${color}`}
        />
      ))}
    </div>
  );
}
