---
name: UI Design Improvements Plan
overview: "Implement four design improvement areas: replace hardcoded colors with tokens, unify page headers, add Field Plan dark mode support, improve empty/loading states and affordances, and ensure project badge contrast."
todos: []
isProject: false
---

# UI Design Improvements Implementation Plan

## 1. Consistency — Replace Hardcoded Colors with Tokens

### 1.1 Add Missing Design Tokens

Add to [src/styles/_variables.css](src/styles/_variables.css):

```css
/* Amber subtle backgrounds (for blocked/warning states) */
--color-amber-bg-subtle: #fffaf2;
--color-amber-bg-hover: #fff5e5;

/* Semantic badge backgrounds (for diff badges, status chips) */
--color-ready-bg-badge: rgba(22, 163, 74, 0.12);
--color-primary-bg-badge: rgba(59, 130, 246, 0.12);
--color-recording-bg-badge: rgba(239, 68, 68, 0.12);
--color-muted-bg-badge: rgba(0, 0, 0, 0.05);
```

Add dark-mode equivalents in the `@media (prefers-color-scheme: dark)` block.

### 1.2 Replace Hardcoded Colors by File


| File                                                                         | Replacements                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/styles/components/field-plan.css](src/styles/components/field-plan.css) | `.field-plan-row--blocked`: `#fffaf2` → `var(--color-amber-bg-subtle)`, `#fff5e5` → `var(--color-amber-bg-hover)`. Import card diff badges (lines 706–722): use `--color-ready-bg-badge`, `--color-primary-bg-badge`, `--color-recording-bg-badge`, `--color-muted-bg-badge` and semantic text tokens |
| [src/styles/components/task-card.css](src/styles/components/task-card.css)   | `.task-card:hover`: `#f5f5f5` → `var(--color-surface-hover)`, `.task-card:active`: `#f0f0f0` → `var(--color-border)` (or add `--color-surface-active`)                                                                                                                                                |
| [src/styles/components/timer.css](src/styles/components/timer.css)           | `.timer-bar__button`: `border-radius: 8px` → `var(--radius-md)`                                                                                                                                                                                                                                       |
| [src/styles/components/fab.css](src/styles/components/fab.css)               | `color: #fff` → `white` (or add `--color-on-primary`) — low priority, `#fff` is acceptable                                                                                                                                                                                                            |


### 1.3 Unify Page Headers

**Current state:**

- TodayView, ProjectList, PlanList: `--font-large`, `font-weight: 800`, `color: var(--color-text)` (correct)
- SettingsView: `--font-small`, uppercase, muted (incorrect for primary page title)

**Change:** Update [src/styles/components/settings.css](src/styles/components/settings.css) so `.settings-view__title` matches the shared pattern:

```css
.settings-view__title {
  font-size: var(--font-large);
  font-weight: 800;
  color: var(--color-text);
  text-transform: none;
  letter-spacing: normal;
  margin: 0 0 var(--space-xs);
}
```

Verify Field Plan overlay title (`field-plan-overlay__title`) already uses `--font-large` and 800 weight — it does.

---

## 2. Dark Mode Coverage — Field Plan

### 2.1 Add Dark Mode Overrides in _dark.css

Add a new section in [src/styles/_dark.css](src/styles/_dark.css) for Field Plan components:

```css
/* --- Field Plan Overlay --- */
.field-plan-overlay {
  background: var(--color-bg);
}

.field-plan-overlay__header {
  background: var(--color-surface-subtle);
  border-bottom-color: var(--color-border);
}

.field-plan-overlay__content {
  /* inherits from main */
}

.field-plan-overlay__empty {
  background: var(--color-surface-subtle);
}

/* Plan selector, header card, task list — use existing surface tokens */
.field-plan__plan-btn,
.field-plan__plan-btn--active,
.field-plan__header-card,
.field-plan-row,
.field-plan__unplanned,
.field-plan__action-btn,
.field-plan-import-card {
  /* Ensure backgrounds use tokens; override blocked row */
}

.field-plan-row--blocked {
  background: rgba(217, 119, 6, 0.15);  /* amber subtle in dark */
}

.field-plan-row--blocked:hover {
  background: rgba(217, 119, 6, 0.22);
}

/* Import card diff badges — use token-based colors that work in dark */
.field-plan-import-card__diff-badge--new { background: var(--color-budget-under-bg); color: var(--color-budget-under); }
.field-plan-import-card__diff-badge--updated { background: rgba(59, 130, 246, 0.2); color: var(--color-primary); }
.field-plan-import-card__diff-badge--unchanged { background: var(--color-muted-bg-badge); color: var(--color-text-muted); }
.field-plan-import-card__diff-badge--removed { background: var(--color-recording-bg); color: var(--color-recording); }
```

Reference existing dark mode patterns (e.g. `.task-row`, `.settings-view__card`) for surface colors (`#252525`, `#1e1e1e`, etc.).

---

## 3. Polish — Empty States, Loading States, Affordances

### 3.1 Empty States

**Target views:** TodayView, Field Plan empty, ProjectList, PlanList, Planning workspace, Settings sub-views (Work Types, Templates, etc.)

**Pattern to apply:**

- Heading (short, actionable)
- Supporting line (1–2 sentences)
- Primary CTA button when applicable
- Optional: small icon above text (reuse existing icons from [src/components/icons.tsx](src/components/icons.tsx), e.g. `TaskListIcon`)

**Files to update:**

- [src/pages/TodayView.tsx](src/pages/TodayView.tsx): Wrap empty content in a structured div, add `TaskListIcon`, refine copy
- [src/pages/field-plan/FieldPlanOverlay.tsx](src/pages/field-plan/FieldPlanOverlay.tsx): Empty section already has heading + description + CTA; add icon for consistency
- [src/pages/ProjectList.tsx](src/pages/ProjectList.tsx): Enhance `project-list__empty` with icon and clearer copy
- [src/pages/planning/PlanList.tsx](src/pages/planning/PlanList.tsx): Add icon to `planning-view__empty`
- [src/pages/planning/workspace/PlanningWorkspaceShell.tsx](src/pages/planning/workspace/PlanningWorkspaceShell.tsx): Already has icon + heading + description — good reference

Create a shared `.empty-state` CSS class in a new or existing file (e.g. `_base.css` or `today-view.css`) for consistent padding, gap, text alignment, and icon size.

### 3.2 Loading States

**Current:** Plain text "Loading...", "Loading tasks...", etc.

**Improvement:** Add a subtle spinner or skeleton for key views.

- Add a reusable `.loading-spinner` or `.loading-dots` component/style (CSS-only, no new React component required)
- Update [src/pages/TodayView.tsx](src/pages/TodayView.tsx): Replace "Loading tasks..." with spinner + text
- Update [src/App.tsx](src/App.tsx): Replace root "Loading..." with spinner + text
- Update [src/components/TaskTimeTracking.tsx](src/components/TaskTimeTracking.tsx): Replace "Loading..." div with spinner + text
- Settings views (Attribution, Remediation, KpiSection): Use same pattern

Reuse or create a minimal spinner in CSS (e.g. rotating border) keyframed in `_base.css`.

### 3.3 Tab Bar Active State

In [src/styles/components/tab-nav.css](src/styles/components/tab-nav.css):

- Increase indicator thickness: `box-shadow: inset 0 3px 0 0` → `inset 0 4px 0 0`
- Optionally add a subtle background tint for active tab: `background: rgba(37, 99, 235, 0.06)` when `--active`

### 3.4 Action Sheet Handle

In [src/styles/components/action-sheet.css](src/styles/components/action-sheet.css):

- `.action-sheet__handle`: `width: 36px` → `40px`, `height: 4px` → `5px`, `border-radius: 2px` → `3px`
- Consider slightly darker background for better visibility: `var(--color-border)` or a dedicated `--color-handle` token

---

## 4. Accessibility — Project Badge Contrast

### 4.1 Approach

PROJECT_COLORS in [src/lib/types.ts](src/lib/types.ts) are saturated hex values. White text on some (e.g. cyan, teal) may not meet WCAG AA. Two options:

**Option A (recommended):** Add a `getContrastColor(hex)` utility that returns `'white'` or `'black'` based on relative luminance. Use it when rendering the project badge.

**Option B:** Restrict PROJECT_COLORS to colors that pass contrast with white, or darken any that fail.

### 4.2 Implementation (Option A)

1. Add `getContrastColor(hex: string): 'white' | 'black'` in [src/lib/utils/](src/lib/utils/) (e.g. `contrast.ts` or extend an existing util). Formula: compute relative luminance of hex; if luminance > 0.179, use black, else white.
2. Update [src/pages/TodayView.tsx](src/pages/TodayView.tsx) project badge:

```tsx
<span
  className="today-view__project-badge"
  style={{
    backgroundColor: project.color,
    color: getContrastColor(project.color),
  }}
>
  {project.name}
</span>
```

1. Check [src/pages/ProjectDetail.tsx](src/pages/ProjectDetail.tsx) and any other place that renders a project-colored badge with text. Apply the same pattern if present.
2. Add unit tests for `getContrastColor` with a few PROJECT_COLORS to ensure correct output.

---

## Implementation Order

1. **Tokens and consistency** — Add tokens, replace hardcoded colors, unify Settings header
2. **Field Plan dark mode** — Add `_dark.css` overrides
3. **Project badge contrast** — Add utility, update TodayView and any other badge usages
4. **Polish** — Empty states, loading spinner, tab bar, action sheet handle

---

## Files Summary


| Category         | Files to Modify                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens           | `_variables.css`                                                                                                                                |
| Consistency      | `field-plan.css`, `task-card.css`, `timer.css`, `settings.css`                                                                                  |
| Dark mode        | `_dark.css`                                                                                                                                     |
| Project contrast | New `contrast.ts`, `TodayView.tsx`, possibly `ProjectDetail.tsx`                                                                                |
| Empty/loading    | `TodayView.tsx`, `FieldPlanOverlay.tsx`, `ProjectList.tsx`, `PlanList.tsx`, `App.tsx`, `TaskTimeTracking.tsx`, `_base.css` or new `loading.css` |
| Affordances      | `tab-nav.css`, `action-sheet.css`                                                                                                               |


