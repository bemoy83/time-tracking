/**
 * ProjectColorDot component.
 * Presentational component for project color indicators.
 */

import { ColorSwatch } from './ColorSwatch';

interface ProjectColorDotProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProjectColorDot({
  color,
  size = 'md',
  className = '',
}: ProjectColorDotProps) {
  return <ColorSwatch color={color} size={size} shape="dot" className={className} />;
}
