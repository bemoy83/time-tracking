---
name: LineItemCard UI Improvements
overview: "Implement the high, medium, and low-priority LineItemCard UI improvements: risk level visual treatment, hardcoded color replacement, header hierarchy, accessibility improvements, and action button affordances. The work type select redesign is deferred."
todos:
  - id: tokens
    content: Add --color-amber-dark, --color-primary-bg-subtle, --color-primary-bg-active tokens to _variables.css
    status: pending
  - id: hardcoded-colors
    content: Replace hardcoded colors in line-item-card.css, line-item-fields.css, and feedback.css with new tokens
    status: pending
  - id: risk-css
    content: Add .planning-view__risk--high and --medium CSS (border + background tint) in line-item-card.css and dark mode overrides in dark/planning.css
    status: pending
  - id: risk-indicator
    content: Add risk indicator dot element and CSS in LineItemCard.tsx header for high/medium risk
    status: pending
  - id: header-spacing
    content: Increase title-to-select gap, add separator between header and fields, remove redundant help text from JSX
    status: pending
  - id: a11y
    content: Add aria-label to select, aria-describedby to numeric inputs, aria-live to risk warnings, fieldset grouping, and sr-only class in _a11y.css
    status: pending
  - id: action-buttons
    content: Increase action icon size to 20px and unify border-radius to var(--radius-full)
    status: pending
  - id: rationale-divider
    content: Add border-top divider and padding to .planning-view__rationale in feedback.css
    status: pending
isProject: false
---

# LineItemCard UI Improvements

## Scope

All changes are scoped to the LineItemCard component and its supporting CSS. No new React components are required. The work type select redesign is deferred.

## Files to Change

- `[src/styles/_variables.css](src/styles/_variables.css)` — new tokens
- `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)` — risk treatment, hardcoded color replacement, header spacing, rationale divider
- `[src/styles/components/planning/line-item-fields.css](src/styles/components/planning/line-item-fields.css)` — hardcoded color replacement
- `[src/styles/components/planning/feedback.css](src/styles/components/planning/feedback.css)` — hardcoded color replacement
- `[src/styles/dark/planning.css](src/styles/dark/planning.css)` — dark mode for risk levels and new tokens
- `[src/pages/planning/LineItemCard.tsx](src/pages/planning/LineItemCard.tsx)` — ARIA attributes

---

## 1. New Design Tokens

Add to the `:root` block in `[src/styles/_variables.css](src/styles/_variables.css)`:

```css
/* Amber text — for warnings on amber-tinted backgrounds */
--color-amber-dark: #92400e;

/* Primary subtle backgrounds — for hover/active on primary-colored icons and banners */
--color-primary-bg-subtle: rgba(37, 99, 235, 0.08);
--color-primary-bg-active: rgba(37, 99, 235, 0.2);
```

Add dark mode overrides inside the existing `@media (prefers-color-scheme: dark)` block in `[src/styles/dark/planning.css](src/styles/dark/planning.css)`:

```css
/* Tokens don't cascade through :root in dark media query; override component styles */
.planning-view__unit-warning {
  background: rgba(217, 119, 6, 0.15);
  color: var(--color-budget-approaching); /* #fbbf24 in dark */
}
.planning-view__recompute-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.15);
}
```

---

## 2. [HIGH] Risk Level Visual Treatment

The class `planning-view__risk--high` is applied to the card root but has no CSS. Add to `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)`:

```css
/* Risk level — left border accent + background tint */
.planning-view__risk--high {
  border-left: 3px solid var(--color-recording);
  background: var(--color-recording-bg);
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

.planning-view__risk--medium {
  border-left: 3px solid var(--color-amber);
  background: var(--color-budget-approaching-bg);
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

.planning-view__risk--low {
  /* No special treatment; consistent with no-risk */
}
```

Add dark mode overrides in `[src/styles/dark/planning.css](src/styles/dark/planning.css)`:

```css
.planning-view__risk--high {
  background: var(--color-recording-bg); /* #2d1f1f in dark */
}
.planning-view__risk--medium {
  background: var(--color-budget-approaching-bg);
}
```

Additionally, add a compact risk indicator in the card header so risk is visible at a glance without scrolling. In `[src/pages/planning/LineItemCard.tsx](src/pages/planning/LineItemCard.tsx)`, render a small colored indicator dot in the header alongside the title when `suggestion?.risk` is `'high'` or `'medium'`:

```tsx
{suggestion && (suggestion.risk === 'high' || suggestion.risk === 'medium') && (
  <span
    className={`planning-view__risk-indicator planning-view__risk-indicator--${suggestion.risk}`}
    aria-label={`${suggestion.risk} risk`}
    title={`${suggestion.risk} risk`}
  />
)}
```

Add the indicator CSS to `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)`:

```css
.planning-view__risk-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px; /* align with title baseline */
}
.planning-view__risk-indicator--high { background: var(--color-recording); }
.planning-view__risk-indicator--medium { background: var(--color-amber); }
```

Place it as the first child inside `.planning-view__line-item-info` (before the title), or float it to the right of the title — right-of-title is less intrusive given title uses `text-overflow: ellipsis`.

---

## 3. [HIGH] Replace Hardcoded Colors with Tokens

### In `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)`

Unit warning block (lines 141–178):

```css
/* Before */
background: color-mix(in srgb, #d97706 10%, transparent);
color: #92400e;
/* ...dismiss hover: */
background: color-mix(in srgb, #d97706 12%, transparent);

/* After */
background: var(--color-budget-approaching-bg);
color: var(--color-amber-dark);
/* ...dismiss hover: */
background: var(--color-budget-approaching-bg);
```

### In `[src/styles/components/planning/line-item-fields.css](src/styles/components/planning/line-item-fields.css)`

Recompute button hover/active (lines 78–83):

```css
/* Before */
background: rgba(37, 99, 235, 0.1);  /* hover */
background: rgba(37, 99, 235, 0.2);  /* active */

/* After */
background: var(--color-primary-bg-subtle); /* hover */
background: var(--color-primary-bg-active); /* active */
```

### In `[src/styles/components/planning/feedback.css](src/styles/components/planning/feedback.css)`

KPI suggestion background (line 10):

```css
/* Before */
background: rgba(37, 99, 235, 0.08);

/* After */
background: var(--color-primary-bg-subtle);
```

---

## 4. [MEDIUM] Header Hierarchy and Spacing

In `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)`:

- Increase gap between title and work-type select: change the `:has(.planning-view__work-type-select)` override from `gap: var(--space-xs)` to `gap: var(--space-sm)`
- Add a visual separator between the header and fields grid:

```css
.planning-view__line-item-fields {
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-xs);
}
```

- Remove the redundant "Category, phase, and unit" help text from the JSX since the select options already include this information. This declutters the header. Update `[src/pages/planning/LineItemCard.tsx](src/pages/planning/LineItemCard.tsx)`:

```tsx
{/* Remove this line */}
<span className="planning-view__field-help">Category, phase, and unit</span>
```

---

## 5. [MEDIUM] Accessibility

In `[src/pages/planning/LineItemCard.tsx](src/pages/planning/LineItemCard.tsx)`:

**Work type select:**

```tsx
<select
  className="input planning-view__work-type-select"
  value={item.workTypeId ?? ''}
  onChange={handleWorkTypeChange}
  aria-label="Work type, build phase, and unit"
>
```

**Numeric inputs — link help text via `aria-describedby`:**
Each input needs an `id` on the help text and a matching `aria-describedby`:

```tsx
<input
  type="number"
  className="input"
  value={item.workQuantity}
  onChange={(e) => onUpdate({ workQuantity: Number(e.target.value) })}
  onFocus={selectOnFocus}
  aria-describedby={`${item.id}-qty-help`}
/>
<span className="planning-view__field-help" id={`${item.id}-qty-help`}>
  Total in {WORK_UNIT_LABELS[item.workUnit]}
</span>
```

Apply the same pattern to Crew, Time, and Rate fields.

**Risk warnings — live region:**

```tsx
{suggestion && suggestion.riskReasons.length > 0 && (
  <div
    className="planning-view__risk-warnings"
    role="status"
    aria-live="polite"
    aria-label="Risk warnings"
  >
    ...
  </div>
)}
```

**Fields group — semantic grouping:**

```tsx
<fieldset className="planning-view__line-item-fields">
  <legend className="sr-only">Work package metrics</legend>
  {/* fields */}
</fieldset>
```

Add a `sr-only` utility class in `[src/styles/_a11y.css](src/styles/_a11y.css)` (if not already present):

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## 6. [LOW] Action Button Affordances

In `[src/styles/components/planning/line-item-card.css](src/styles/components/planning/line-item-card.css)`, increase the action icons to 20×20px (from 18×18) and ensure consistent `border-radius` (use `var(--radius-full)` for all, not `50%` on some and `9999px` on others):

```css
.planning-view__line-item-action-icon { width: 20px; height: 20px; }
.planning-view__line-item-duplicate,
.planning-view__line-item-remove {
  border-radius: var(--radius-full); /* was 50% */
}
```

The `title` and `aria-label` attributes in the JSX are already correct — no changes needed there.

---

## 7. [LOW] Rationale Input — Visual Separation

Add a subtle divider above the rationale section in `[src/styles/components/planning/feedback.css](src/styles/components/planning/feedback.css)`:

```css
.planning-view__rationale {
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-xs);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

---

## Implementation Order

1. Add tokens to `_variables.css`
2. Replace hardcoded colors (3 CSS files)
3. Add risk level CSS + dark mode overrides
4. Add risk indicator dot to `LineItemCard.tsx`
5. Header hierarchy and spacing changes
6. Accessibility changes in `LineItemCard.tsx` + `_a11y.css`
7. Action button and rationale polish

