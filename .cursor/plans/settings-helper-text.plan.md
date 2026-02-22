---
name: ""
overview: ""
todos: []
isProject: false
---

# Settings Section Helper Text Plan

## Overview

Add uppercase section titles and short helper text to every settings section so users quickly understand each section's purpose.

## Mission

- All sections have uppercase titles (e.g. TIMERS, DATA, WORK TYPES)
- All cards display section helper text explaining content
- Helper text uses the short alternative wording

## Section Helper Text (Short)


| Section             | Title               | Helper Text                                      |
| ------------------- | ------------------- | ------------------------------------------------ |
| Timers              | TIMERS              | Configure parallel subtask timers                |
| Data                | DATA                | Clear entries or reset all data                  |
| Work Types          | WORK TYPES          | Add and manage work categories for estimates     |
| Templates           | TEMPLATES           | Create reusable presets for faster task creation |
| Productivity        | PRODUCTIVITY        | View KPIs and use the estimate calculator        |
| Attribution Quality | ATTRIBUTION QUALITY | Set attribution policy and monitor quality       |


## Structure

Each section card uses this pattern:

```
<h2 class="settings-view__sub-header">TIMERS</h2>
<p class="settings-view__helper">Configure parallel subtask timers</p>
[content]
```

Titles render in uppercase via existing `.settings-view__sub-header` CSS (`text-transform: uppercase`).

## Gap Analysis


| Location                                                                               | Current State                  | Required Change                             |
| -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| **SettingsView** — Timers                                                              | Sub-header only                | Add helper text below sub-header            |
| **SettingsView** — Data                                                                | Sub-header only                | Add helper text below sub-header            |
| **SettingsView** — Drill-down cards (Work Types, Templates, Productivity, Attribution) | Link row only, no title/helper | Add sub-header + helper text above link row |
| **SettingsWorkTypesView**                                                              | Sub-header only                | Add helper text below sub-header            |
| **SettingsTemplatesView**                                                              | Sub-header only                | Add helper text below sub-header            |
| **SettingsProductivityView**                                                           | Sub-header only                | Add helper text below sub-header            |
| **SettingsAttributionView**                                                            | Sub-header only                | Add helper text below sub-header            |


## File Summary


| Action | Path                                              | Change                                                                               |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Modify | `src/styles/components/settings.css`              | Add `.settings-view__helper` — font-small, color-text-muted, margin below sub-header |
| Modify | `src/pages/SettingsView.tsx`                      | Add helper to Timers, Data; add sub-header + helper to each drill-down card          |
| Modify | `src/pages/settings/SettingsWorkTypesView.tsx`    | Add helper text under sub-header                                                     |
| Modify | `src/pages/settings/SettingsTemplatesView.tsx`    | Add helper text under sub-header                                                     |
| Modify | `src/pages/settings/SettingsProductivityView.tsx` | Add helper text under sub-header                                                     |
| Modify | `src/pages/settings/SettingsAttributionView.tsx`  | Add helper text under sub-header                                                     |


## Implementation Notes

**Drill-down cards (main Settings page):** The four sections currently render a single button. Update structure to:

```tsx
<div className="settings-view__card">
  <h2 className="settings-view__sub-header">Work Types</h2>
  <p className="settings-view__helper">Add and manage work categories for estimates</p>
  <button className="settings-view__link-row" onClick={...}>
    <span className="settings-view__link-row-label">Work Types</span>
    <ChevronRightIcon className="settings-view__link-row-chevron" />
  </button>
</div>
```

Update `drillDownSections` to include `helper`:

```ts
const drillDownSections = [
  { key: 'workTypes', label: 'Work Types', helper: 'Add and manage work categories for estimates' },
  { key: 'templates', label: 'Templates', helper: 'Create reusable presets for faster task creation' },
  { key: 'productivity', label: 'Productivity', helper: 'View KPIs and use the estimate calculator' },
  { key: 'attribution', label: 'Attribution Quality', helper: 'Set attribution policy and monitor quality' },
];
```

**Cards with card-header:** For Work Types, Templates, Productivity, Attribution detail views, the sub-header lives in `.settings-view__card-header` alongside the action button. Add the helper as a sibling that wraps to full width (or place it between header and content). Ensure helper appears below the header row, before the list or primary content.