import { useRef, useEffect, useState } from 'react';

interface AmendmentPopoverProps {
  anchor: HTMLElement | null;
  lineItemTitle: string;
  date: string;
  isAssigning: boolean;
  onConfirm: (note: string | null) => void;
  onCancel: () => void;
}

export function AmendmentPopover({
  anchor,
  lineItemTitle,
  date,
  isAssigning,
  onConfirm,
  onCancel,
}: AmendmentPopoverProps) {
  const [reason, setReason] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchor &&
        !anchor.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel, anchor]);

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const action = isAssigning ? 'Assigning' : 'Removing';
  const preposition = isAssigning ? 'to' : 'from';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason.trim() || null);
  };

  // Position near the anchor element
  const style: React.CSSProperties = {};
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    style.position = 'fixed';
    style.top = rect.bottom + 4;
    style.left = Math.max(8, rect.left - 80);
    style.zIndex = 100;
  }

  return (
    <div
      ref={popoverRef}
      className="amendment-popover"
      style={style}
      role="dialog"
      aria-label="Schedule amendment"
    >
      <form onSubmit={handleSubmit}>
        <p className="amendment-popover__summary">
          {action} <strong>{lineItemTitle}</strong> {preposition} {formattedDate}
        </p>
        <input
          ref={inputRef}
          type="text"
          className="input amendment-popover__input"
          placeholder="Reason for change (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="amendment-popover__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}
