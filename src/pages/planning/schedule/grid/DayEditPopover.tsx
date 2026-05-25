import { useEffect, useRef } from 'react';
import type { WorkCalendarDay } from '../../../../lib/planning/plan-model';

interface DayEditPopoverProps {
  anchor: HTMLElement;
  day: WorkCalendarDay;
  defaultCrewSize: number | null;
  onUpdate: (date: string, updates: Partial<WorkCalendarDay>) => void;
  onClose: () => void;
}

export function DayEditPopover({ anchor, day, defaultCrewSize, onUpdate, onClose }: DayEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, anchor]);

  const rect = anchor.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 4,
    left: rect.left,
    zIndex: 200,
  };

  return (
    <div
      ref={popoverRef}
      className="day-edit-popover"
      style={style}
      role="dialog"
      aria-label="Edit day crew and hours"
    >
      <div className="day-edit-popover__field">
        <label className="day-edit-popover__label">Crew</label>
        <input
          type="number"
          className="day-edit-popover__input"
          min={0}
          step={1}
          value={day.crewSize ?? ''}
          placeholder={String(defaultCrewSize ?? '')}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) =>
            onUpdate(day.date, {
              crewSize: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
            })
          }
        />
      </div>
      <div className="day-edit-popover__field">
        <label className="day-edit-popover__label">Start</label>
        <input
          type="time"
          className="day-edit-popover__input"
          value={day.accessStart ?? '08:00'}
          onChange={(e) => onUpdate(day.date, { accessStart: e.target.value || null })}
        />
      </div>
      <div className="day-edit-popover__field">
        <label className="day-edit-popover__label">End</label>
        <input
          type="time"
          className="day-edit-popover__input"
          value={day.accessEnd ?? '16:00'}
          onChange={(e) => onUpdate(day.date, { accessEnd: e.target.value || null })}
        />
      </div>
    </div>
  );
}
