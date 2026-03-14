/**
 * ProjectColorDot component.
 * Presentational component for project color indicators.
 */

import { getProjectDisplayColor } from '../lib/types';
import { ColorSwatch } from './ColorSwatch';

interface ProjectColorDotProps {
  color?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ProjectColorDot({
  color,
  size = 'md',
  className = '',
}: ProjectColorDotProps) {
  return <ColorSwatch color={getProjectDisplayColor(color)} size={size} shape="dot" className={className} />;
}
