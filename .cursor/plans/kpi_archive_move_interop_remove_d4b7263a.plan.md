---
name: KPI Archive Move Interop Remove
overview: Move KPI export and Archive Maintenance into the Productivity section, then remove the Interop section and clean up all interop-specific code.
todos: []
isProject: false
---

# Move KPI/Archive to Productivity and Remove Interop

## Summary

1. Add KPI export and Archive Maintenance to [SettingsProductivityView](src/pages/settings/SettingsProductivityView.tsx)
2. Remove Interop section from navigation and routing
3. Delete [SettingsInteropView](src/pages/settings/SettingsInteropView.tsx) and the interop folder
4. Relocate WorkPackageImportCard (used by Templates) before deleting interop

---

## Phase 1: Move KPI Export and Archive Maintenance to Productivity

### 1.1 Relocate hooks and cards

**Move files** (not copy) from `interop/` to shared settings locations:


| From                                            | To                                 |
| ----------------------------------------------- | ---------------------------------- |
| `interop/hooks/useInteropKpiExport.ts`          | `hooks/useKpiExport.ts`            |
| `interop/hooks/useInteropArchiveMaintenance.ts` | `hooks/useArchiveMaintenance.ts`   |
| `interop/cards/KpiExportCard.tsx`               | `cards/KpiExportCard.tsx`          |
| `interop/cards/ArchiveMaintenanceCard.tsx`      | `cards/ArchiveMaintenanceCard.tsx` |


- Rename hooks: `useInteropKpiExport` → `useKpiExport`, `useInteropArchiveMaintenance` → `useArchiveMaintenance`
- Update KpiExportCard helper text: "Export archive-grade KPI profiles" (drop "for planner interop")

### 1.2 Update SettingsProductivityView

**File:** [src/pages/settings/SettingsProductivityView.tsx](src/pages/settings/SettingsProductivityView.tsx)

- Add `useWorkTypeStore` for `workTypes`
- Add `useState` for `exportSummary` (replaces Interop's shared `onSummary`)
- Add `useKpiExport({ tasks, workTypes, onSummary: setExportSummary })`
- Add `useArchiveMaintenance({ onSummary: setExportSummary })`
- Insert KpiExportCard and ArchiveMaintenanceCard into the view (KpiExportCard after KpiSection card; ArchiveMaintenanceCard after that, wrapped in `archiveToolsEnabled` check)
- Display `exportSummary` when set

---

## Phase 2: Relocate WorkPackageImportCard (Templates dependency)

Templates already uses `useTemplateImport` (from the Templates import/export plan). Only the card needs moving.

**Move** (before interop deletion):


| From                                      | To                                |
| ----------------------------------------- | --------------------------------- |
| `interop/cards/WorkPackageImportCard.tsx` | `cards/WorkPackageImportCard.tsx` |


- Update [SettingsTemplatesView](src/pages/settings/SettingsTemplatesView.tsx): change import from `./interop/cards/WorkPackageImportCard` to `./cards/WorkPackageImportCard`
- Do NOT move `useInteropWorkPackageImport` — Templates uses `useTemplateImport`. Delete `useInteropWorkPackageImport` with Interop.

---

## Phase 3: Remove Interop Section

### 3.1 Remove from SettingsView

**File:** [src/pages/SettingsView.tsx](src/pages/SettingsView.tsx)

- Remove `'interop'` from `SettingsSection` type
- Remove `{ key: 'interop', ... }` from `drillDownSections`
- Feature flag "Interop stale import guard" becomes unused (it was only in `useInteropWorkPackageImport`). Optionally remove it in this cleanup or leave for a later pass.

### 3.2 Remove from App routing

**File:** [src/App.tsx](src/App.tsx)

- Remove `'interop'` from `SettingsSection` type
- Remove `SettingsInteropView` import
- Remove the `view.section === 'interop'` conditional block
- Ensure `handleNavigateToSection` and any `section`-driven logic no longer reference `'interop'`

### 3.3 Delete files

- [src/pages/settings/SettingsInteropView.tsx](src/pages/settings/SettingsInteropView.tsx)
- [src/pages/settings/interop/hooks/useInteropWorkTypeInterop.ts](src/pages/settings/interop/hooks/useInteropWorkTypeInterop.ts)
- [src/pages/settings/interop/hooks/useInteropWorkPackageImport.ts](src/pages/settings/interop/hooks/useInteropWorkPackageImport.ts)
- [src/pages/settings/interop/cards/WorkTypeExportCard.tsx](src/pages/settings/interop/cards/WorkTypeExportCard.tsx)
- [src/pages/settings/interop/](src/pages/settings/interop/) (entire folder after moving/removing contents)

---

## Phase 4: Cleanup and Tests

### 4.1 Ensure cards/hooks directories exist

Create if missing:

- `src/pages/settings/cards/` (for KpiExportCard, ArchiveMaintenanceCard, WorkPackageImportCard)
- `src/pages/settings/hooks/` (already exists for useTemplateImport)

### 4.2 SettingsInteropView.test.tsx

**File:** [src/pages/settings/SettingsInteropView.test.tsx](src/pages/settings/SettingsInteropView.test.tsx)

- Delete this file (it tests Interop view and work package apply)
- The work package apply logic is covered by `applyWorkPackageImportItems` and `useTemplateImport`; consider adding a test for `useTemplateImport` or the Templates view if coverage drops

### 4.3 Verify no broken imports

After moves and deletions:

- `SettingsTemplatesView` → `WorkPackageImportCard` from `./cards/`, `useTemplateImport` (unchanged)
- `SettingsProductivityView` → `KpiExportCard`, `ArchiveMaintenanceCard`, `useKpiExport`, `useArchiveMaintenance`

---

## File Change Summary


| Action | Path                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| Create | `settings/cards/` (if missing)                                                       |
| Move   | `interop/cards/KpiExportCard.tsx` → `cards/KpiExportCard.tsx`                        |
| Move   | `interop/cards/ArchiveMaintenanceCard.tsx` → `cards/ArchiveMaintenanceCard.tsx`      |
| Move   | `interop/cards/WorkPackageImportCard.tsx` → `cards/WorkPackageImportCard.tsx`        |
| Move   | `interop/hooks/useInteropKpiExport.ts` → `hooks/useKpiExport.ts`                     |
| Move   | `interop/hooks/useInteropArchiveMaintenance.ts` → `hooks/useArchiveMaintenance.ts`   |
| Modify | `SettingsProductivityView.tsx` — add KPI export and Archive Maintenance              |
| Modify | `SettingsTemplatesView.tsx` — update WorkPackageImportCard import path to `./cards/` |
| Modify | `SettingsView.tsx` — remove interop section                                          |
| Modify | `App.tsx` — remove interop route and import                                          |
| Delete | `SettingsInteropView.tsx`                                                            |
| Delete | `interop/hooks/useInteropWorkTypeInterop.ts`                                         |
| Delete | `interop/cards/WorkTypeExportCard.tsx`                                               |
| Delete | `SettingsInteropView.test.tsx`                                                       |
| Delete | `interop/` folder (after all moves)                                                  |


---

## Implementation Order

1. Create `settings/cards/` if needed; move KpiExportCard, ArchiveMaintenanceCard, WorkPackageImportCard
2. Create `hooks/useKpiExport.ts`, `hooks/useArchiveMaintenance.ts` (move and rename from interop)
3. Update SettingsProductivityView with KPI export and Archive Maintenance
4. Update SettingsTemplatesView: change WorkPackageImportCard import to `./cards/WorkPackageImportCard`
5. Remove interop from SettingsView and App
6. Delete SettingsInteropView, useInteropWorkTypeInterop, useInteropWorkPackageImport, WorkTypeExportCard, SettingsInteropView.test
7. Delete empty interop folder
8. Run tests and fix any broken imports

