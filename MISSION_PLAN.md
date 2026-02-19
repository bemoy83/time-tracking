Mission Plan

Quantified Task & Productivity Tracking

Mission Statement

Reduce task setup friction by introducing reusable task structure that enables fast execution today and intelligent planning tomorrow — without changing how work is executed.

Guiding Principles

Execution UX (Today view) is sacred

Templates accelerate, never enforce

Productivity is measured on tasks, learned from history

Analytics require structure, not user effort

Desktop planning ≠ mobile execution

Current State (Baseline)
Task (existing)

Only Title is required.

Optional fields:

Time

Estimate

Tracking

Time entries

Work

Amount

Unit type (required if amount exists)

Personnel

Crew size

Productivity

Required productivity (if work + time estimate exist)

Achieved productivity (if work + tracked time exist)

Notes

Subtasks

Today view:

Task list

Swipe to start / stop / complete

Duration + duration-based status color

Drill-in task detail for edits

Current limitation:
There is no task archive feature yet; completed tasks remain in Today or are otherwise not stored for KPI aggregation.

Phase 1 — Introduce Task Templates (Foundation)
Goal

Define recurring task structure once and reuse it.

New Entity: TaskTemplate

Purpose: Pre-fill task fields at creation time.

Fields (all optional except where noted):

Title

Work

Unit type (required)

Default amount (optional)

Time

Estimate (optional)

Personnel

Default crew size (optional)

Productivity

Target productivity (single value)

Metadata

Build phase (Build-up | Tear-down)

Work category (predefined)

Rules:

Templates never track time

Templates never appear in Today

Templates define defaults, not constraints

Phase 2 — Template → Task Instantiation
Goal

Create tasks faster without changing task behavior.

Task Creation Flow

User chooses:

Blank task (current behavior)

Template-based task

When using a template:

All template fields are copied to task

User may edit any field

Only Title remains required

After creation:

Task is indistinguishable from any other task

Today view behavior is unchanged

Phase 3 — Productivity Targets (Task-Level)
Goal

Make productivity expectations usable and visible.

Behavior

Target productivity is copied:

Template → Task

Stored on task as required productivity

Achieved productivity is calculated when:

Work exists

Tracked time exists

UI Scope (v1)

Task detail only

No changes to Today task rows

Phase 4 — Work Structure for Analytics
Goal

Enable meaningful KPI aggregation without execution friction.

New Concept: Work Category

Predefined list (no user creation)

Selected in template

Copied to task

Read-only during execution

Productivity Key (Critical)

Productivity is grouped by:

Work Category + Unit Type (+ Build Phase)


This combination defines a unique Work Type for analytics.

Phase 5 — Task Archive & KPI Foundation (Planned)
Goal

Turn completed work into learning.

Note: This phase is not implemented yet; currently, tasks are not archived.

Planned Behavior

Completed tasks feed KPI data

Grouped by:

Work category

Unit type

Build phase (optional)

KPI Metrics (computed)

Average achieved productivity

Sample count

Variance (future)

No forecasting yet — visibility only.

Phase 6 — Intelligent Productivity Calculator (Future)
Goal

Support planning decisions using real data.

Calculator Inputs

Work category

Unit type

Build phase (optional)

Productivity source:

Template target

Historical average (requires task archive)

Supported Calculations

Crew size

crew = work / (time × productivity)


Time

time = work / (crew × productivity)


Calculator is advisory, not authoritative.

Phase 7 — Planner Integration (Future)

Unlocked by previous phases:

KPI export (Excel / CSV)

Import planned work

Desktop planning UI

Not required for MVP.

Explicit Non-Goals (for now)

No task categories (replaced by work category)

No productivity ranges

No forecasting UI

No planner roles

No changes to Today UX

No enforcement of work or time fields

No task archive yet

Placeholder Types (Safe to Stub)

You can stub these immediately:

TaskTemplate

WorkCategory

BuildPhase

TargetProductivity

ArchivedTaskKPI (planned)

They can remain thin until later phases.

Success Criteria

Creating a task from a template takes < 10 seconds

Execution flow feels unchanged

Productivity expectations are visible but non-intrusive

KPI aggregation requires no manual mapping (once task archive is implemented)