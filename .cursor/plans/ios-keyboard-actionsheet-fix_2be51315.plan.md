---
name: ios-keyboard-actionsheet-fix
overview: Rework ActionSheet keyboard handling on iOS by (1) separating sheet open from keyboard call, and (2) anchoring sheet to the visual viewport. User taps input to summon keyboard; sheet opens first without auto-focus.
todos:
  - id: separate-sheet-and-keyboard
    content: Remove auto-focus from CreateTaskSheet title input so sheet opens first; user taps to summon keyboard
    status: pending
  - id: anchor-sheet-to-visual-viewport
    content: Change sheet from position fixed to absolute inside backdrop; backdrop already sized to visual viewport
    status: pending
  - id: harden-viewport-sync
    content: Add fallback for unreliable visualViewport.offsetTop on iOS; ensure cleanup on close
    status: pending
  - id: optional-scroll-lock
    content: (Optional) Upgrade modal scroll lock to iOS-safe pattern if needed
    status: pending
  - id: cross-sheet-regression-check
    content: Verify CreateTaskSheet and other ActionSheet consumers under keyboard open/close cycles
    status: pending
isProject: false
---

# Stabilize ActionSheet With iOS Keyboard

## Strategy: Separate Sheet Open From Keyboard Call

**Phase 1 (primary):** Decouple the action sheet open from the keyboard. The sheet opens and renders fully; the user manually taps the title input to focus it and summon the keyboard. This avoids:
- The race between sheet animation and keyboard appearance
- Complex viewport handling during the opening animation

**Phase 2:** When the user does tap and the keyboard appears, anchor the sheet to the visual viewport so it stays above the keyboard.

**Constraint:** The title input must be visible without scrolling when the sheet opens (it is, as the first form field).

---

## Current Problems

- `CreateTaskSheet` uses `autoFocus` on the title input, so the keyboard opens immediately when the sheet opens. This creates a race with the sheet animation and viewport changes.
- The sheet uses `position: fixed; bottom: 0`, which anchors to the layout viewport. With `interactive-widget=overlays-content`, the keyboard overlays content and the layout viewport does not shrink—so the sheet sits behind the keyboard.
- `ActionSheet` syncs backdrop `top/height` to visual viewport, but the sheet itself remains layout-viewport-anchored.

---

## Implementation steps

### 1. Separate sheet open from keyboard call

- In [CreateTaskSheet.tsx](src/components/CreateTaskSheet.tsx): remove `autoFocus` from the title input.
- User flow: tap "+" or "Add task" → sheet opens → user taps title input → keyboard appears.
- The title input remains at the top of the sheet, visible without scrolling.

### 2. Anchor sheet to visual viewport

- In [action-sheet.css](src/styles/components/action-sheet.css): change the sheet from `position: fixed` to `position: absolute`.
- The backdrop is already `position: fixed` and is sized to the visible viewport by `syncViewport()` (top, height). With `position: absolute`, the sheet anchors to the backdrop; its `bottom: 0` aligns with the bottom of the visible area (above the keyboard).

### 3. Harden viewport sync

- In [ActionSheet.tsx](src/components/ActionSheet.tsx): add fallback when `visualViewport.offsetTop` is 0 or unreliable (common on iOS). Keep RAF throttling and full cleanup on close.

### 4. (Optional) Scroll lock

- In [useModalFocusTrap.ts](src/lib/hooks/useModalFocusTrap.ts): consider iOS-safe scroll lock (fixed + scrollY restore) if `overflow: hidden` proves insufficient. Validate against other modal consumers.

### 5. Input focus fallback

- Keep `scrollIntoView` in CreateTaskSheet `onFocus` as a fallback when the user taps and the keyboard opens. Use `block: 'center'` if desired.

---

## Acceptance criteria

- Sheet opens without keyboard; title input is visible without scrolling.
- User taps input → keyboard appears; sheet and input remain above keyboard.
- Dismiss keyboard → sheet and viewport return to normal.
- No regressions in other ActionSheet usages (`TaskNotes`, `TaskWorkQuantity`, `TaskPersonnel`, `TaskTimeTracking`).

