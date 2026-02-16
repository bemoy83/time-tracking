interface ColorSwatchProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  shape?: 'dot' | 'swatch';
  interactive?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  className?: string;
}

export function ColorSwatch({
  color,
  size = 'md',
  selected = false,
  shape = 'dot',
  interactive = false,
  onClick,
  'aria-label': ariaLabel,
  className = '',
}: ColorSwatchProps) {
  const classes = [
    'color-swatch',
    `color-swatch--${size}`,
    `color-swatch--${shape}`,
    selected ? 'color-swatch--selected' : '',
    interactive ? 'color-swatch--interactive' : '',
    className,
  ].join(' ').trim();

  if (interactive) {
    return (
      <button
        type="button"
        className={classes}
        style={{ backgroundColor: color }}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={selected}
      />
    );
  }

  return <span className={classes} style={{ backgroundColor: color }} aria-hidden="true" />;
}
