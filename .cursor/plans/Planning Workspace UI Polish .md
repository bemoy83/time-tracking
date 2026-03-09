 Planning Workspace UI Polish                                                                                                       
                                                                          
 Context

 The planning workspace is desktop-only and centers on the PlanEditor with a WorkPackageTable. The current UI has several issues:
 the table's min-width: 1080px causes unnecessary horizontal scroll even though individual columns have spare room; phase columns
 blend together; the add-bar is disconnected from the table; secondary buttons lack contrast; and table row actions are invisible
 until hover. This plan addresses all of these in a focused set of changes.

 ---
 Changes

 1. Tighten table column min-widths to reduce min-width to ~920px

 File: src/styles/components/planning/work-package-table.css

 Reduce column min-widths to fit tighter without clipping content:

 ┌────────────────────────────┬─────────┬────────┐
 │           Column           │ Current │  New   │
 ├────────────────────────────┼─────────┼────────┤
 │ Title                      │ 200px   │ 180px  │
 ├────────────────────────────┼─────────┼────────┤
 │ Type (select)              │ 190px   │ 160px  │
 ├────────────────────────────┼─────────┼────────┤
 │ Qty / Rate / Hrs (numeric) │ 84px    │ 72px   │
 ├────────────────────────────┼─────────┼────────┤
 │ Crew (numeric)             │ 72px    │ 60px   │
 ├────────────────────────────┼─────────┼────────┤
 │ Unit                       │ 64px    │ 56px   │
 ├────────────────────────────┼─────────┼────────┤
 │ Actions                    │ 104px   │ 96px   │
 ├────────────────────────────┼─────────┼────────┤
 │ Table min-width            │ 1080px  │ ~920px │
 └────────────────────────────┴─────────┴────────┘

 The title and type columns use flexible <input>/<select> elements that wrap text — they don't need 200/190px minimums. Numeric
 columns display short numbers (0-9999, 1-2 decimals) that fit comfortably in 72/60px.

 2. Integrate add-bar into the table as a tfoot row

 Files:
 - src/pages/planning/PlanEditor.tsx — move add-bar JSX into WorkPackageTable as props
 - src/pages/planning/WorkPackageTable.tsx — render add inputs in a <tfoot> row
 - src/styles/components/planning/work-package-table.css — style the tfoot row

 The add-bar currently sits above the table as a separate flex container. Move it into the table's <tfoot> so it:
 - Scrolls horizontally with the table (aligned columns)
 - Lives visually at the top of the table, directly under the header (using CSS caption-side or placing tfoot visually via order,
 or simply reordering in the DOM to render after thead)
 - Has a subtle top border and slightly different background to distinguish from data rows without competing with headers

 Implementation approach:
 - Pass addRow props to WorkPackageTable: newTitle, newWorkTypeId, newQuantity, newWorkType, selectableWorkTypes,
 addDisabledReason, onNewTitleChange, onNewWorkTypeIdChange, onNewQuantityChange, onAddRow, addTitleRef
 - Render a <tfoot> row after <thead> in DOM (CSS will keep it at the bottom of rendered table, but since tfoot is always visible
 and the table is not paginated, placing it right after thead with display: table-header-group on tfoot will position it visually
 after the header)
 - Actually: simplest approach is to render a second <tbody> immediately after <thead> with a single "add" row. HTML allows
 multiple tbody elements, and this naturally places the add row right below the headers.
 - Style with a subtle bottom border (--wp-add-bar-divider) and the contained-bg background, matching current add-bar aesthetics.
 - Remove the standalone .planning-view__wp-add-bar div from PlanEditor.

 3. Stronger phase column differentiation

 File: src/styles/_variables.css, src/styles/_dark.css

 Add distinct subtle tints per phase:
 - Build-up columns: faint blue tint (rgba(37, 99, 235, 0.03) light / rgba(96, 165, 250, 0.04) dark)
 - Tear-down columns: faint amber tint (rgba(217, 119, 6, 0.03) light / rgba(245, 158, 11, 0.04) dark)

 Update --wp-phase-bg to split into --wp-phase-buildup-bg and --wp-phase-teardown-bg, and apply each to the corresponding columns
 via existing class hooks or new modifiers.

 4. Table row actions: visible at low opacity by default

 File: src/styles/components/planning/work-package-table.css

 Change the actions container from opacity: 0 to opacity: 0.25 by default, keeping the hover/focus-within at opacity: 1. This
 provides a visual hint that actions exist without cluttering.

 5. Secondary button contrast improvement

 File: src/styles/components/btn.css

 Add a 1px solid var(--surface-contained-border) border to .btn--secondary so it has a clear boundary against similar-colored
 backgrounds. Keep the existing background.

 6. Scroll shadow on table wrapper

 File: src/styles/components/planning/work-package-table.css

 Apply the same four-layer scroll shadow technique already used on .planning-workspace__tabs to
 .planning-view__work-package-table-wrap. Use --surface-contained-bg as the mask color since the table sits on a contained surface.

 File: src/styles/_dark.css

 Add dark mode override for the table wrapper scroll shadows (matching the existing tabs pattern).

 ---
 Files to modify

 1. src/styles/components/planning/work-package-table.css — column widths, table min-width, add-row styles, action opacity, scroll
 shadows
 2. src/pages/planning/WorkPackageTable.tsx — accept add-row props, render add row in second tbody
 3. src/pages/planning/PlanEditor.tsx — pass add-row state/handlers to WorkPackageTable, remove standalone add-bar div
 4. src/styles/_variables.css — split phase-bg tokens into buildup/teardown variants
 5. src/styles/_dark.css — dark mode overrides for new phase tokens and scroll shadows
 6. src/styles/components/btn.css — secondary button border

 ---
 Verification

 1. Open the app in a browser at desktop width (>1024px)
 2. Navigate to Planning workspace, select a plan
 3. Verify the table no longer scrolls horizontally on common desktop widths (~1200px+)
 4. Verify the add row appears directly below the table headers, inputs align with columns
 5. Verify build-up columns have a faint blue tint, tear-down columns a faint amber tint
 6. Verify row action buttons are faintly visible without hovering, and fully visible on hover
 7. Verify secondary buttons ("Schedule", "Progress") have a visible border
 8. If the table does scroll (narrow window), verify scroll shadows appear at edges
 9. Check dark mode for all of the above
 10. Run existing tests: npm test (or npx vitest run)