/**
 * SwipeableRow component.
 * Provides swipe gestures (touch and pointer/mouse) with long-press fallback.
 *
 * Design requirements from PLAN.md:
 * - Swipe actions for Complete, Start/stop timer
 * - Long-press fallback (no gesture-only critical actions)
 * - 44px+ touch targets
 */

import { useState, useRef, useCallback } from 'react';

interface SwipeAction {
  label: string;
  icon: React.ReactNode;
  color: string;
  onAction: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  onLongPress?: () => void;
}

const SWIPE_THRESHOLD = 80;
const LONG_PRESS_DURATION = 500;

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  onLongPress,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const hasTriggeredAction = useRef(false);
  const isPointerActive = useRef(false);
  const hasPointerCapture = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Only primary (left) mouse button
      // Don't capture yet – wait for drag. Capturing on down steals tap/click from children.
      isPointerActive.current = true;
      startX.current = e.clientX;
      startY.current = e.clientY;
      currentX.current = e.clientX;
      isHorizontalSwipe.current = null;
      hasTriggeredAction.current = false;

      // Start long-press timer
      if (onLongPress) {
        longPressTimer.current = window.setTimeout(() => {
          onLongPress();
          hasTriggeredAction.current = true;
        }, LONG_PRESS_DURATION);
      }
    },
    [onLongPress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerActive.current) return;
      const deltaX = e.clientX - startX.current;
      const deltaY = e.clientY - startY.current;

      // Cancel long press on any movement
      clearLongPress();

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // Only handle horizontal swipes
      if (isHorizontalSwipe.current) {
        e.preventDefault();
        // Mouse: capture now so we get pointermove/up when pointer leaves the element
        if (!hasPointerCapture.current) {
          const target = e.currentTarget as HTMLElement;
          target.setPointerCapture(e.pointerId);
          hasPointerCapture.current = true;
        }
        currentX.current = e.clientX;
        setIsDragging(true);

        // Constrain offset based on available actions
        let newOffset = deltaX;
        if (!rightAction && newOffset < 0) newOffset = 0;
        if (!leftAction && newOffset > 0) newOffset = 0;

        // Apply resistance at edges
        const maxOffset = SWIPE_THRESHOLD + 20;
        if (Math.abs(newOffset) > maxOffset) {
          const sign = newOffset > 0 ? 1 : -1;
          const excess = Math.abs(newOffset) - maxOffset;
          newOffset = sign * (maxOffset + excess * 0.2);
        }

        setOffset(newOffset);
      }
    },
    [leftAction, rightAction, clearLongPress]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      isPointerActive.current = false;
      if (hasPointerCapture.current) {
        hasPointerCapture.current = false;
        const target = e.currentTarget as HTMLElement;
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore if capture was already released
        }
      }
      clearLongPress();
      setIsDragging(false);

      if (hasTriggeredAction.current) {
        setOffset(0);
        return;
      }

      // Check if swipe threshold was met
      if (offset > SWIPE_THRESHOLD && leftAction) {
        leftAction.onAction();
      } else if (offset < -SWIPE_THRESHOLD && rightAction) {
        rightAction.onAction();
      }

      setOffset(0);
    },
    [offset, leftAction, rightAction, clearLongPress]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      isPointerActive.current = false;
      if (hasPointerCapture.current) {
        hasPointerCapture.current = false;
        const target = e.currentTarget as HTMLElement;
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore if capture was already released
        }
      }
      clearLongPress();
      setIsDragging(false);
      setOffset(0);
    },
    [clearLongPress]
  );

  const leftTriggered = offset > SWIPE_THRESHOLD;
  const rightTriggered = offset < -SWIPE_THRESHOLD;

  // Only render the action matching the current swipe direction
  // so the two full-width backgrounds don't overlap
  const showLeft = leftAction && offset > 0;
  const showRight = rightAction && offset < 0;

  return (
    <div className="swipeable-row">
      {/* Left action background (visible when swiping right) */}
      {showLeft && (
        <div
          className={`swipeable-row__action swipeable-row__action--left ${
            leftTriggered ? 'swipeable-row__action--triggered' : ''
          }`}
          style={{ backgroundColor: leftAction.color }}
        >
          <div className="swipeable-row__action-content">
            {leftAction.icon}
            <span className="swipeable-row__action-label">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right action background (visible when swiping left) */}
      {showRight && (
        <div
          className={`swipeable-row__action swipeable-row__action--right ${
            rightTriggered ? 'swipeable-row__action--triggered' : ''
          }`}
          style={{ backgroundColor: rightAction.color }}
        >
          <div className="swipeable-row__action-content">
            {rightAction.icon}
            <span className="swipeable-row__action-label">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="swipeable-row__content"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {children}
      </div>
    </div>
  );
}
