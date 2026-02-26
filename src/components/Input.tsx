/**
 * Shared input field — pill-shaped, reusable across the app.
 * Forwards ref and all native input props.
 */

import { forwardRef } from 'react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`input ${className}`.trim()}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
