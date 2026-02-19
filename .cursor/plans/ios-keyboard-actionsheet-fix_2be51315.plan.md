---
name: ios-keyboard-actionsheet-fix
overview: Rework ActionSheet keyboard handling on iOS by anchoring to the visual viewport (not just changing max-height), and harden modal scroll-lock behavior so focused inputs remain visible.
todos:
  - id: audit-actionsheet-viewport-logic
    content: Refactor ActionSheet runtime viewport math to handle visualViewport height and offset with RAF throttling + cleanup
    status: pending
  - id: stabilize-actionsheet-css
    content: Update action-sheet CSS anchoring/scroll behavior for iOS keyboard resilience
    status: pending
  - id: upgrade-modal-scroll-lock
    content: Implement iOS-safe body scroll lock in shared modal focus-trap hook
    status: pending
  - id: cross-sheet-regression-check
    content: Verify New Task and other ActionSheet consumers under keyboard open/close cycles
    status: pending
isProject: false
---

# Stabilize ActionSheet With iOS Keyboard

## What appears to be failing now

- Current code in `[/Users/bemoy/Developer/time-tracking/src/components/ActionSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/ActionSheet.tsx)` only updates `maxHeight` from `visualViewport.height`.
- It does **not** account for `visualViewport.offsetTop/offsetLeft`, so when iOS shifts the visual viewport during keyboard open, sheet/backdrop can still be visually displaced.
- The sheet is `position: absolute` inside a fixed backdrop in `[/Users/bemoy/Developer/time-tracking/src/styles/components/action-sheet.css](/Users/bemoy/Developer/time-tracking/src/styles/components/action-sheet.css)`, which is fragile under iOS keyboard viewport shifts.
- Scroll lock in `[/Users/bemoy/Developer/time-tracking/src/lib/hooks/useModalFocusTrap.ts](/Users/bemoy/Developer/time-tracking/src/lib/hooks/useModalFocusTrap.ts)` uses `body { overflow: hidden; }` only; on iOS this often still allows viewport/position oddities when inputs focus.

## Revised strategy

- Anchor overlay behavior to **visual viewport geometry** (height + offset), not layout viewport assumptions.
- Keep ActionSheet independently scrollable and prevent body/background scroll using iOS-safe lock behavior.
- Keep the existing viewport meta fallback in `[/Users/bemoy/Developer/time-tracking/index.html](/Users/bemoy/Developer/time-tracking/index.html)`, but treat it as non-authoritative for iOS.

## Implementation steps

1. Refactor `ActionSheet` viewport handling:
  - In `[/Users/bemoy/Developer/time-tracking/src/components/ActionSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/ActionSheet.tsx)`, compute and apply runtime styles from `visualViewport`:
    - `maxHeight` based on `visualViewport.height`
    - vertical offset compensation using `visualViewport.offsetTop`
    - optional backdrop `top/height` sync to visual viewport
  - Guard for missing `window.visualViewport`.
  - Use `requestAnimationFrame` throttling for `resize/scroll` handlers.
  - Cleanly reset all inline styles on close/unmount.
2. Make sheet positioning robust in CSS:
  - In `[/Users/bemoy/Developer/time-tracking/src/styles/components/action-sheet.css](/Users/bemoy/Developer/time-tracking/src/styles/components/action-sheet.css)`, switch sheet anchoring from `absolute`-inside-backdrop to viewport-stable positioning (`fixed`), while preserving width/max-width and animations.
  - Keep `overflow-y: auto`, add iOS-friendly scrolling/overscroll containment for the sheet.
3. Harden iOS scroll lock behavior:
  - Update `[/Users/bemoy/Developer/time-tracking/src/lib/hooks/useModalFocusTrap.ts](/Users/bemoy/Developer/time-tracking/src/lib/hooks/useModalFocusTrap.ts)` from plain `overflow: hidden` to fixed-position lock with stored scrollY restore (iOS-safe pattern), while preserving current focus-trap behavior.
  - Ensure this does not regress other modals using the same hook.
4. Keep input focus behavior additive, not primary:
  - Retain title-input `scrollIntoView` in `[/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx)` as a fallback only; main stability comes from viewport anchoring.
5. Validate behavior on real iOS keyboard flows:
  - Open New Task sheet, focus title input, verify top of sheet and input remain visible.
  - Dismiss keyboard and reopen to confirm no stuck offset state.
  - Verify background page does not scroll while sheet is open.

## Acceptance criteria

- Focusing title input on iOS no longer pushes ActionSheet content off-screen.
- Keyboard overlays lower sheet area while title input remains visible.
- Sheet remains scrollable internally; background remains locked.
- No regressions in other ActionSheet usages (`TaskNotes`, `TaskWorkQuantity`, `TaskPersonnel`, `TaskTimeTracking`).

