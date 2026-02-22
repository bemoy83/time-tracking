# Settings Page Polish Plan

## Overview

Visual consistency pass for all settings surfaces: unified typography for headers, equal card padding, divider rules (only between list items), and consistent uppercase sub-headers with helper text.

## Current State

- **Page title** ([`settings-view__title`](src/styles/components/settings.css)): `font-large`, `font-weight: 700`
- **Detail title** ([`settings-detail__title`](src/styles/components/settings.css)): `font-large`, `font-weight: 700`
- **Section headers** (`.section-heading`): `font-body`, `font-weight: 600`, `uppercase`, `color-text-muted`
- **Card padding**: `var(--space-xs) var(--space-md) var(--space-md)` (asymmetric — small top, larger bottom)
- **Dividers**: Rows and danger links use `border-top`; `:first-child` removes top border on first row. Some cards (Timers, Data) show a line between header and first content element.

## Target Design

### 1. Unified header typography

All settings headers (page title, detail title, section sub-headers) share the same font, size, and color.

- **Proposed:** Create `.settings-header` (or extend `.section-heading` for settings context) with single values:
  - `font-size: var(--font-small)` (or `var(--font-body)`)
  - `font-weight: 600`
  - `color: var(--color-text-muted)`
  - `text-transform: uppercase`
  - `letter-spacing: 0.05em`

Apply to:
- Main "Settings" page title
- Detail page titles (Work Types, Templates, etc.)
- Section sub-headers inside cards ("TIMERS", "DATA", "WORK TYPES", etc.)

### 2. Equal card padding (content centered vertically)

Change `.settings-view__card` from asymmetric padding to symmetric:

```css
/* Before */
padding: var(--space-xs) var(--space-md) var(--space-md);

/* After */
padding: var(--space-md);
```

This gives equal top and bottom padding. Adjust `--space-md` if a different token better achieves the desired visual weight.

### 3. Dividers only where items are displayed as a list

**Rule:** Divider lines appear only between list items. No line between section header and first content element.

**Implementation:**

- Introduce `.settings-view__list` wrapper for list content. Only children of this wrapper get `border-top` (except `:first-child`).
- Single-item / non-list content (Timers toggle, Data action buttons, link rows) gets no dividers.
- Current rows (`.settings-view__row`), danger links (`.settings-view__danger-link`), and link rows (`.settings-view__link-row`) should lose their default `border-top` when not inside a list container.
- Apply `border-top` only to `.settings-view__list > *:not(:first-child)` or keep it on `.settings-view__row` when the row is inside `.settings-view__list`.

**Affected areas:**

| Location | Content type | Divider behavior |
|----------|--------------|-------------------|
| Timers card | Single toggle | No dividers |
| Drill-down cards | Single link row | No dividers |
| Data card | Two danger buttons | List of 2 — divider between buttons only |
| Work Types / Templates / Productivity / Attribution cards | Lists | Divider between list items only |

**Data card:** Wrap the two danger buttons in `.settings-view__list` so the divider appears only between them.

### 4. Section sub-headers with helper text

Each section shows an uppercase sub-header (e.g. "TIMERS") above its content.

**Structure:**
```
[card]
  [sub-header] TIMERS
  [content]
```

**Changes:**

- Add a dedicated sub-header element: `<h2 class="settings-view__sub-header">TIMERS</h2>` (or re-use a consistent class).
- Replace current section titles with this pattern. Sub-header text:
  - Timers → "TIMERS"
  - Data → "DATA"
  - Work Types → "WORK TYPES"
  - Templates → "TEMPLATES"
  - Productivity → "PRODUCTIVITY"
  - Attribution Quality → "ATTRIBUTION QUALITY"

Optional: add a brief helper line under the label (e.g. "TIMERS" with "Configure timer behavior") if desired; the plan assumes the uppercase label is the primary sub-header.

## File Summary

| Action | Path |
|--------|------|
| Modify | `src/styles/components/settings.css` — card padding, list divider pattern, sub-header styles |
| Modify | `src/styles/components/section-heading.css` — optional: add settings-specific override or new class |
| Modify | `src/pages/SettingsView.tsx` — add sub-headers for Timers, Data; wrap Data buttons in list container |
| Modify | `src/pages/settings/SettingsWorkTypesView.tsx` — sub-header "WORK TYPES", ensure list wrapper |
| Modify | `src/pages/settings/SettingsTemplatesView.tsx` — sub-header "TEMPLATES", ensure list wrapper |
| Modify | `src/pages/settings/SettingsProductivityView.tsx` — sub-header "PRODUCTIVITY", ensure list wrapper |
| Modify | `src/pages/settings/SettingsAttributionView.tsx` — sub-header "ATTRIBUTION QUALITY", ensure list wrapper |
| Modify | `src/pages/settings/SettingsDetailLayout.tsx` — use unified header style for page title |

## Implementation Order

1. Add `.settings-view__sub-header` / unified header styles and update card padding in CSS
2. Remove arbitrary dividers: refactor to list-only divider pattern
3. Add sub-headers in each settings view (SettingsView + all four detail views)
4. Apply unified typography to page title and detail layout title
