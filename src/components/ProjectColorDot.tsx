/**
 * ProjectColorDot component.
 * Presentational component for project color indicators.
 */

interface ProjectColorDotProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 7,
  md: 10,
  lg: 24,
} as const;

export function ProjectColorDot({
  color,
  size = 'md',
  className = '',
}: ProjectColorDotProps) {
  const px = sizeMap[size];
  return (
    <span
      className={`project-color-dot ${className}`}
      style={{
        backgroundColor: color,
        width: px,
        height: px,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}
