# Feature Plan — Export & Import

**Priority:** 2 / 3 — Deliverable 2 (outbound export) and Deliverable 3 (import + Field Plan View)
**Roles served:** Planner (export + import), Executor (export + import)
**Status:** Design — not yet implemented
**Related specs:** `feature-field-plan-view.md` (full Field Plan View spec), `feature-wrapup-review-v2.md` (how execution return data is used in wrap-up), `strategy-roadmap.md` (build order)

---

## Problem Statement

The planner and executor are two different people on two different devices. There is no live sync. Currently there is no mechanism to:

- Get an active plan from the planner's device to the executor's device
- Get the executor's time entries back to the planner for wrap-up review
- Protect against data loss from device failure or app data corruption

Export and import together are the offline bridge that makes the two-role model functional. Without them, each person is working in isolation and there is no data continuity between planning and execution.

---

## What Already Exists

The app has a CSV-based interop layer for reference data:
- KPI export (CSV): ops summary, estimator summary, phase summary
- Work package CSV import: creates tasks/templates from a CSV file
- Work type import/export: moves work type definitions between devices

This layer serves **reference data management** — the planner syncing their KPI baselines and work type library across devices. It is not designed for the **operational handoff workflow** described here. The new export/import feature is distinct and complementary.

---

## Four Export Actions

Export is not one feature. It is four distinct actions serving different purposes and audiences.

---

### 1. Plan Package Export (JSON)

**Purpose:** Transfer an active plan from the planner's device to the executor's device.

**When available:** After a plan is made active. Not available for draft plans.

**What it contains:**
- Plan metadata (title, status, lock timestamp)
- All line items with their full field set (quantities, work types, estimates, planned workers, scheduled dates once scheduling exists)
- Embedded work type definitions for all work types referenced in the plan

The work type definitions must travel with the plan. The executor's device may have no work types configured. The export must be entirely self-contained — no external reference resolution required on import.

**Trigger:** Manual action from the plan's Edit tab in the Planning Workspace. Also auto-triggered when a plan is activated (see Auto-Export section).

**Consumer:** Executor's device, via Plan Package Import.

---

### 2. Execution Return Export (JSON)

**Purpose:** Transfer the executor's work session data back to the planner for wrap-up review.

**When available:** At end of event, from the executor's device. Scoped to a specific plan or event period.

**What it contains:**
- Time entries for tasks that originated from an imported plan (linked by plan line item ID)
- Task completion status and timestamps
- Any unplanned tasks created during execution (tasks not from the imported plan)
- Worker counts per time entry

The execution return is designed to be matched back against the original plan on the planner's side. The plan line item IDs in the export are the reconciliation key.

**Trigger:** Manual action — the executor initiates this at the end of the event or work session. Entry point: Today view or a dedicated "End of event" flow. Not automatically triggered (the executor decides when the session is complete).

**Consumer:** Planner's device, via Execution Return Import.

---

### 3. Event Report (HTML / Print-to-PDF)

**Purpose:** Human-readable plan-vs-actual summary for reporting to management or client.

**When available:** Only for reviewed plans (wrap-up complete). The report requires final reconciled data.

**What it contains:**
- Plan header: event name, dates, crew summary
- Per line item: planned quantity, planned person-hours, actual person-hours, variance, productivity achieved vs. target
- Unplanned work section: tasks that ran during execution but were not part of the plan
- Summary statistics: total planned vs. actual, overall productivity, KPI performance
- Wrap-up notes (from `reviewNote` fields on line items)

**Format:** A dedicated print view with `@media print` styles. The user triggers the browser print dialog and saves as PDF from there. No PDF library required — the browser handles rendering. The output must look professional: clean layout, clear typography, suitable for external recipients.

**Trigger:** Manual action from the plan's Review tab in the Planning Workspace. Only appears after wrap-up is complete.

**Consumer:** Management, client — a human reader. Not machine-processable.

---

### 4. Full Backup (JSON)

**Purpose:** Complete snapshot of all app data for resilience against device loss or data corruption.

**When available:** Always. Accessible from Settings.

**What it contains:**
- All plans (all states)
- All tasks and subtasks
- All time entries
- All work types
- All projects
- App-level settings (work type library, KPI baselines)

**Trigger:** Manual from Settings. Also auto-triggered on major lifecycle events (see Auto-Export section).

**Consumer:** Same device (restore), or archival. Machine-readable — must be importable for full restore.

---

## Import Behaviors

### Plan Package Import (on executor's device)

The executor receives a Plan Package JSON file (via AirDrop, shared folder, email, or any file transfer method).

On import:
1. The system shows a preview: plan title, number of line items, work types included
2. The executor confirms
3. The plan is created with `status: 'received'` on the executor's device — the plan structure is not editable but line items can be worked (released, blocked, deferred, annotated)
4. Work type definitions embedded in the package are matched against existing work types by stable key (title + unit + build phase). Matches link to existing records. Non-matches create read-only copies scoped to this plan.
5. All line items are available for release to Today — same mechanism as the existing "Add from plan" flow

The executor's device now has the plan in its working state. The planner and executor are synchronized at the moment of handoff.

**Initial import conflict handling:** If a plan with the same ID already exists on the device with no execution state yet, the user is prompted: replace or skip. No silent overwrite.

**Re-import merge (mid-event update):** If a plan with the same ID already exists and has execution state (line items annotated, tasks released), the import performs a targeted merge:
- **Incoming structural changes** (new line items, modified quantities, work types) are applied — the plan scope reflects the planner's latest version
- **Incoming schedule changes** (day assignments, calendar updates) are applied
- **Executor execution state is fully preserved** — `executionStatus`, `blockReason`, `blockCategory`, `executorNote`, `deferredNote` on existing line items are not touched
- **New line items** from the incoming package are added in Pending state with no execution annotations
- **Removed line items** (planner deleted a line item) are flagged to the executor: "This work package was removed from the plan" — the executor can see it but it is marked inactive

The plan package carries a `lastModifiedAt` timestamp. The executor's device shows: "Plan updated [time] — imported [time]" so the executor always knows whether their copy is current.

---

### Execution Return Import (on planner's device)

The planner receives the executor's Execution Return JSON file.

On import:
1. Preview shows: number of time entries, date range, tasks covered, any unplanned tasks
2. The planner confirms
3. Time entries are added to the local store, linked to their source tasks by plan line item ID
4. If time entries with the same IDs already exist locally (rare — same device scenario), they are skipped and flagged in the import summary
5. The wrap-up review can now see the imported execution data alongside any locally-tracked time

This import does not modify plan state, task state, or any existing records. It is additive only.

---

### Full Backup Import / Restore

Available from Settings. A destructive operation — it replaces all current data with the backup snapshot. Requires explicit confirmation with a clear warning: "This will replace all current data."

Used for device migration or data recovery. Not for routine use.

---

## Auto-Export

Relying on manual exports for backup creates a discipline that tends to lapse. The system should generate exports automatically at key lifecycle moments.

**Auto-export triggers:**

| Event | Export generated |
|---|---|
| Plan set to active | Plan Package JSON |
| Wrap-up review completed | Full Backup JSON |

Auto-exports are saved to the user's chosen backup destination (see below). They are timestamped and named predictably: `plan-[title]-[date].json`, `backup-[date].json`.

If no backup destination has been configured, auto-exports fall back to the browser's default downloads folder with a visible notification.

---

## Backup Destination

The app should not own storage. The right approach is to write exports to a location the operating system already syncs — iCloud Drive, Google Drive, Dropbox, or any folder.

**Mechanism:** File System Access API. The user picks a folder once from Settings ("Set backup folder"). The app stores the permission and writes auto-exports to that folder without prompting each time. The OS handles syncing that folder to the cloud.

**Fallback:** If File System Access API is unavailable (iOS Safari limitations), fall back to a standard browser download prompt for manual saves.

This gives the user cloud backup resilience at zero additional cost, with no vendor dependency.

---

## Export Envelope Schema

Every machine-readable export (Plan Package, Execution Return, Full Backup) wraps its payload in a consistent envelope:

```
{
  schemaVersion: "1.0",
  exportType: "plan-package" | "execution-return" | "full-backup",
  exportedAt: ISO timestamp,
  appVersion: string,
  payload: { ... }
}
```

**Schema versioning is non-negotiable.** The envelope must be present from the first implementation. Import logic checks `schemaVersion` before processing. Incompatible versions are rejected with a clear, user-readable error — not a silent failure.

Future schema changes should be additive where possible (new optional fields). Breaking changes increment the major version. The importer must handle version mismatch gracefully.

The export format is a de-facto internal API. Treat it that way from day one.

---

## Entry Points by Role and Surface

| Action | Where | Who |
|---|---|---|
| Plan Package Export | Plan Edit tab → actions menu | Planner |
| Plan Package Export (auto) | Triggered on plan activation | Planner |
| Execution Return Export | Field Plan View → Close Session | Executor |
| Event Report (HTML/PDF) | Plan Review tab | Planner |
| Full Backup (manual) | Settings | Both |
| Full Backup (auto) | Triggered on wrap-up complete | Planner |
| Plan Package Import | Field Plan View empty state (primary) · Settings → Import (secondary) | Executor |
| Execution Return Import | Settings → Import | Planner |
| Full Backup Restore | Settings → Restore | Both |
| Set backup folder | Settings | Both |

---

## What Import Is Not

Import does not trigger planner-side lifecycle transitions. Importing a plan on the executor's device sets `status: 'received'` — a distinct executor-only state that never maps back to `draft`, `active`, or `reviewed`. The planner's lifecycle (`draft → active → reviewed`) remains owned by the planner's device. The executor's lifecycle (`received → session-closed`) runs in parallel on the executor's device.

Import is not sync. There is no automatic conflict resolution, no delta merging, no real-time update. It is a deliberate, point-in-time data transfer. This is appropriate for the current constraint set and should not be over-engineered toward sync behaviour.

---

## Field Plan View (Executor's Plan Surface)

> **Full spec:** `feature-field-plan-view.md` — this section is a summary only. An implementing agent must read the full spec before building this surface.

Importing a plan creates a new surface on the executor's device: the **Field Plan View**. This is distinct from the Planning Workspace — it is not the planner's workspace adapted for mobile, it is a purpose-built operational view for the executor.

### What it is

A mobile-first, read-only view of a received plan, accessible from the Today view. It shows:

- Plan title and overall status
- All line items with their current execution state: not started / in progress / completed / blocked / deferred
- Which line items are active in Today (already released)
- Which line items are still pending release

### What the executor can do from here

| Action | Purpose |
|---|---|
| Release line item to Today | Existing flow — starts the task in execution |
| Mark line item as blocked | Something is preventing this work; records a reason |
| Mark line item as deferred | This work is being pushed — can't happen now |
| Add a note to a line item | Contextual annotation for the planner's review |

### What the executor cannot do

- Edit quantities, estimates, or work type definitions — planner owns these
- Change plan lifecycle state (lock / unlock / review) — planner owns the lifecycle
- Create new line items in the plan — unplanned work is created as a standalone task in Today, not as a plan edit

### Where it lives

Accessible from the Today view — not a top-level navigation tab. The entry point is a persistent "Plan" control in Today that opens the Field Plan View as a full-screen sheet or subview. The executor stays in Today's context.

### Impact on the Execution Return

The execution return export becomes richer because of this surface. In addition to time entries and completion status, it now carries:

- Any blocked/deferred annotations the executor made on line items
- Notes the executor added during execution

These annotations are the primary feedback mechanism back to the planner. They explain *why* actual diverged from planned — which is more useful to the planner during wrap-up than the numbers alone.

---

## Relationship to Existing Interop Layer

The existing CSV interop (KPI export, work package import, work type import/export) remains unchanged. It serves reference data management — not the operational handoff workflow.

The new JSON-based export/import is a parallel capability, not a replacement. Both coexist in Settings under separate sections:

- **Reference Data**: Work types, KPI baselines (existing CSV flows)
- **Data Transfer**: Plan packages, execution returns, full backup (new JSON flows)

---

## Data Model — Plan Status Extension

Imported plans are stored in the **same `plans` IndexedDB store** as planner-created plans. No separate store is needed. The `PlanStatus` type distinguishes them.

Two new status values are added for the executor device:

| Status | Set by | Meaning |
|---|---|---|
| `received` | Import | Plan imported from planner — active session, executor can work it |
| `session-closed` | Close Session | Executor closed the session — read-only, no further execution actions |

### Storage

All five plan status values (`draft`, `active`, `reviewed`, `received`, `session-closed`) live in the same `plans` store. The status value is the discriminator — no other structural difference exists between a planner plan and an executor plan.

### Surface Filtering

Each UI surface filters the plans store by status:

| Surface | Shows |
|---|---|
| Planning Workspace sidebar | `draft`, `active`, `reviewed` |
| Field Plan View (active) | `received` |
| Field Plan View (past events, collapsed) | `session-closed` |

`received` and `session-closed` plans are **never visible in the Planning Workspace**. `draft`, `active`, and `reviewed` plans are **never visible in the Field Plan View**. A device could theoretically have both planner plans and executor plans (e.g. same person, same device, testing both roles) — the filtering keeps them in their correct surfaces without conflict.

### Plan Record on Import

When a plan package is imported on the executor's device, the system creates a `Plan` record with:
- `status: 'received'`
- `id`: same ID as the planner's original plan (used as the reconciliation key for re-import merge and execution return matching)
- All line items from the package, with executor-specific fields initialised to null (`executionStatus: 'pending'`, `blockReason: null`, `executorNote: null`, etc.)
- `activatedAt`: the planner's `activatedAt` timestamp from the package (preserved for reference)
- `importedAt`: new timestamp recording when this device received the plan

### Close Session Transition

When the executor triggers Close Session, the plan's status transitions from `received` → `session-closed`. The plan record remains in the store — it is not deleted. The executor can view it in the "Past events" section of the Field Plan View but cannot perform any execution actions on it.

---

## Open Questions

**Q1: What file transfer method do planner and executor use?**
The app's responsibility ends at producing the file. The transfer method — AirDrop, shared folder, messaging app, email — is outside scope. The import flow accepts any JSON file from any source. This is intentional: don't prescribe the transfer channel.

**Q2: How does the executor know a new plan is ready for import?**
Out of band for now — the planner tells the executor directly. Once the awareness/notification layer exists, a "plan package ready" signal could be added. Not a blocker for this feature.

**Q3: Should the executor's device show the plan structure, or just the released tasks?**
Resolved: yes — the executor must have a plan view. When something goes wrong on the floor (blocked task, task needs to be pushed or pulled forward), the executor needs to understand the full plan context to make decisions, not just see the active tasks in Today.

This means import creates a plan record on the executor's device, not just tasks. See **Field Plan View** section below.

**Q4: What happens to imported plans/entries when a full backup restore is performed?**
They are included in the backup and restored with everything else. No special handling required — the backup is a complete snapshot.
