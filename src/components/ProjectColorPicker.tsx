/**
 * ProjectColorPicker component.
 * Color swatch grid for selecting a project color.
 */

import { PROJECT_COLORS } from '../lib/types';
import { ColorSwatch } from './ColorSwatch';

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
        <ColorSwatch
          key={color}
          color={color}
          shape="swatch"
          size="lg"
          interactive
          selected={value === color}
          onClick={() => onChange(color)}
          aria-label={`${ariaLabelPrefix} ${color}`}
        />
      ))}
    </div>
  );
}
