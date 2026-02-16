import { ReactNode, Ref } from 'react';

interface InlineCreateFormProps {
  placeholder: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  trailingContent?: ReactNode;
  inputClassName?: string;
  layout?: 'row' | 'block';
  className?: string;
  submitClassName?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export function InlineCreateForm({
  placeholder,
  submitLabel,
  value,
  onChange,
  onSubmit,
  disabled = false,
  trailingContent,
  inputClassName,
  layout = 'row',
  className,
  submitClassName,
  autoFocus = false,
  inputRef,
}: InlineCreateFormProps) {
  const isSubmitDisabled = disabled || !value.trim();

  const classes = [
    'inline-create-form',
    `inline-create-form--${layout}`,
    className ?? '',
  ].join(' ').trim();

  const inputClasses = ['input', inputClassName ?? ''].join(' ').trim();
  const buttonClasses = submitClassName ?? 'btn btn--primary';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit();
  };

  return (
    <form className={classes} onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClasses}
        disabled={disabled}
        autoFocus={autoFocus}
        ref={inputRef}
      />
      {trailingContent}
      <button type="submit" className={buttonClasses} disabled={isSubmitDisabled}>
        {submitLabel}
      </button>
    </form>
  );
}
