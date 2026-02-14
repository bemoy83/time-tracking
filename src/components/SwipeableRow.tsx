/**
 * SwipeableRow component.
 * Provides swipe gestures with long-press fallback for accessibility.
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

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      currentX.current = touch.clientX;
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

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

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
        currentX.current = touch.clientX;
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

  const handleTouchEnd = useCallback(() => {
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
  }, [offset, leftAction, rightAction, clearLongPress]);

  const handleTouchCancel = useCallback(() => {
    clearLongPress();
    setIsDragging(false);
    setOffset(0);
  }, [clearLongPress]);

  const leftTriggered = offset > SWIPE_THRESHOLD;
  const rightTriggered = offset < -SWIPE_THRESHOLD;

  return (
    <div className="swipeable-row">
      {/* Left action background */}
      {leftAction && (
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

      {/* Right action background */}
      {rightAction && (
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {children}
      </div>
    </div>
  );
}
