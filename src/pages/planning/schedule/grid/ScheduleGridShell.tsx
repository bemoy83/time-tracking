import { useCallback } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode, Ref, RefObject } from 'react';

interface ScheduleGridShellProps {
  title: string;
  unscheduledCount: number;
  emptyMessage: string;
  ariaLabel: string;
  calendarLength: number;
  gridColumns: string;
  gridRef: Ref<HTMLDivElement>;
  onGridKeyDown: (e: KeyboardEvent) => void;
  header: ReactNode;
  body: ReactNode;
}

export function useScheduleGridKeyboardNavigation(columnCount: number) {
  return useCallback((gridRef: RefObject<HTMLDivElement | null>, e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('schedule-grid__cell')) return;

    const allCells = gridRef.current?.querySelectorAll<HTMLElement>('.schedule-grid__cell');
    const cells = allCells ? Array.from(allCells).filter((cell) => cell.tabIndex >= 0) : null;
    if (!cells) return;

    const currentIndex = cells.indexOf(target);
    if (currentIndex === -1) return;

    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowDown':
        nextIndex = currentIndex + columnCount;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex - columnCount;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        target.click();
        return;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < cells.length) {
      e.preventDefault();
      cells[nextIndex].focus();
    }
  }, [columnCount]);
}

export function ScheduleGridShell({
  title,
  unscheduledCount,
  emptyMessage,
  ariaLabel,
  calendarLength,
  gridColumns,
  gridRef,
  onGridKeyDown,
  header,
  body,
}: ScheduleGridShellProps) {
  return (
    <section className="schedule-view__block" aria-labelledby="schedule-grid-title">
      <header className="schedule-view__block-header" id="schedule-grid-title">
        <h3 className="schedule-view__block-title">
          {title}
          {unscheduledCount > 0 && (
            <span className="schedule-grid__unscheduled-badge">
              {unscheduledCount} unscheduled
            </span>
          )}
        </h3>
      </header>

      {calendarLength === 0 ? (
        <p className="schedule-view__muted">{emptyMessage}</p>
      ) : (
        <div className="schedule-grid__scroll-wrap">
          <div
            className="schedule-grid"
            ref={gridRef}
            onKeyDown={onGridKeyDown}
            role="grid"
            aria-label={ariaLabel}
            style={{ '--schedule-day-count': calendarLength, gridTemplateColumns: gridColumns } as CSSProperties}
          >
            {header}
            <div className="schedule-grid__body">
              {body}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
