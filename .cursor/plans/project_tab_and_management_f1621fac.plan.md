---
name: Project Tab and Management
overview: Add Projects tab with project list page, project detail view, project colors, and project deletion (unassign or delete tasks). Remove add-project from TodayView. Task project badge navigates to project detail.
todos: []
isProject: false
---

# Project Tab and Full Project Management Plan

Expand project feature: new Projects tab, project list/detail pages, color selection, navigation from task badge to project detail, add-task-from-project, and project deletion with two modes.

---

## Current State

- **App:** Two tabs (Today, Tasks), view types: tab | taskDetail
- **TodayView:** Has Add Project section (lines 172–211) – to be removed
- **TaskDetail:** Project badge opens ProjectPicker for assignment
- **Project type:** id, name, createdAt, updatedAt (no color)
- **task-store:** createProject(name), assignToProject, updateProjectName; no deleteProject, no updateProjectColor

---

## 1. Data Layer: Project Color and Delete

### Types

**File:** [src/lib/types.ts](src/lib/types.ts)

- Add `Project.color: string` (hex or CSS color value)
- Define `PROJECT_COLORS: readonly string[]` – predefined palette (e.g. 8–12 colors, high contrast per CONTEXT)

### DB

**File:** [src/lib/db.ts](src/lib/db.ts)

- Bump `DB_VERSION` to 2
- In `upgrade`, run migration for existing projects: read all, add `color: PROJECT_COLORS[0]` if missing, put back (idb `openDB` upgrade receives old version)
- Add `deleteProject(id: string): Promise<void>` – `db.delete('projects', id)`

### Store

**File:** [src/lib/stores/task-store.ts](src/lib/stores/task-store.ts)

- Extend `createProject(name, color?)` – default color from palette
- Add `updateProjectColor(id, color): Promise<void>`
- Add `deleteProject(id, mode: 'unassign' | 'delete_tasks'): Promise<void>`
  - `unassign`: set `projectId: null` on all tasks with that projectId, then delete project
  - `delete_tasks`: for each task (including subtasks), use `deleteTaskWithEntries`-style logic (cascade), then delete project
- Add `refreshProjects()` if needed
- When deleting project with tasks, stop any active timer on those tasks before deleting

---

## 2. Navigation and App Shell

### View State

**File:** [src/App.tsx](src/App.tsx)

Extend view type:

```ts
type Tab = 'today' | 'tasks' | 'projects';

type View =
  | { type: 'tab'; tab: Tab }
  | { type: 'taskDetail'; taskId: string }
  | { type: 'projectDetail'; projectId: string; returnTo: { type: 'tab'; tab: Tab } | { type: 'taskDetail'; taskId: string } };
```

### Tab Bar

- Add Projects tab (folder/project icon)
- Adjust layout for three tabs (e.g. equal width)

### Routing

- `view.type === 'tab' && tab === 'projects'` → `ProjectList` page
- `view.type === 'projectDetail'` → `ProjectDetail` page
- `handleBack` from project detail uses `returnTo` to restore previous view

---

## 3. ProjectList Page

**File:** `src/pages/ProjectList.tsx` (new)

- List all projects (name + color chip)
- “Add project” button (44px) at top or bottom
- Tapping a project → navigate to ProjectDetail with `returnTo: { type: 'tab', tab: 'projects' }`
- Add-project flow: inline form or modal with name + color picker
  - Color picker: grid of `PROJECT_COLORS` swatches
  - Submit: `createProject(name, color)`

---

## 4. ProjectDetail Page

**File:** `src/pages/ProjectDetail.tsx` (new)

**Props:** `projectId`, `onBack`, `onSelectTask`, `returnTo`

**Content:**

- Header: back button, project name, color badge
- Edit project: tap name to edit (rename, change color) – optional in v1 or simple inline edit
- List of tasks assigned to this project (top-level; use `useProjectTasks(projectId)` or equivalent)
- “Add task” form: input + Add → `createTask({ title, projectId })`
- Delete project button (destructive styling)

**Delete project flow:**

- If `tasks.length === 0`: confirm “Delete project X?”, then `deleteProject(id, 'unassign')` (no-op on tasks)
- If `tasks.length > 0`: show `DeleteProjectConfirm` with:
  - Option A: “Unassign all tasks” – sets `projectId: null`, deletes project
  - Option B: “Delete project and all tasks” – shows combined warning (total tasks, total time if any), reuses DeleteTaskConfirm pattern
  - Cancel

---

## 5. DeleteProjectConfirm Component

**File:** `src/components/DeleteProjectConfirm.tsx` (new)

**Props:** `isOpen`, `projectName`, `taskCount`, `totalTimeMs`, `onUnassign`, `onDeleteTasks`, `onCancel`

**Content:**

- Title: “Delete project?”
- If `taskCount > 0`: two primary actions:
  1. “Unassign tasks” – keep tasks, clear projectId, delete project
  2. “Delete project and tasks” – same warning as task delete (time loss, cannot undo)
- If `taskCount === 0`: single “Delete” action
- Cancel button

For “Delete project and tasks”: reuse wording from DeleteTaskConfirm, e.g. “This will permanently delete [project] and its X tasks, including Y of tracked time. This cannot be undone.”

---

## 6. TaskDetail: Project Badge → Project Detail

**File:** [src/pages/TaskDetail.tsx](src/pages/TaskDetail.tsx)

- Remove ProjectPicker usage for the main project badge
- Make project badge tappable: when tapped, call `onSelectProject(project)` or `onNavigateToProject(projectId)` (provided by App)
- Badge styling: use `project.color` as background/border
- App passes `onNavigateToProject` that sets view to `projectDetail` with `returnTo: { type: 'taskDetail', taskId }`
- Keep ProjectPicker for “Add to project” when task has no project (optional – or navigate to ProjectList to create and assign via project detail). Simpler: if no project, show “Add to project” that still opens ProjectPicker for assignment. If has project, badge navigates to detail.

---

## 7. Remove Add Project from TodayView

**File:** [src/pages/TodayView.tsx](src/pages/TodayView.tsx)

- Remove `showProjectCreate`, `newProjectName`, `handleAddProject`, and the Add Project block (lines 172–211)
- Remove `createProject` import
- Keep project grouping as is (uses existing projects)

---

## 8. Color in Project Badge

**Places to update:**

- **TaskDetail:** Project badge uses `project.color` for background or border
- **TodayView:** Section headers for project use `project.color`
- **ProjectList:** Project chips use `project.color`
- **ProjectDetail:** Header color chip
- **ProjectPicker:** If still used, show color next to project name

Define CSS variable or inline style, e.g. `style={{ backgroundColor: project.color }}` or `--project-color` with sufficient contrast.

---

## 9. Project Create/Edit with Color

**ProjectList add form:**

- Name input
- Color picker: clickable swatches from `PROJECT_COLORS`
- Submit: `createProject(name, selectedColor)`

**Store:** `createProject` and `updateProject` must persist and expose `color`.

---

## 10. Files Summary


| File                                                                 | Action                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [src/lib/types.ts](src/lib/types.ts)                                 | Add `Project.color`, `PROJECT_COLORS`                                             |
| [src/lib/db.ts](src/lib/db.ts)                                       | Bump version, migrate projects, add `deleteProject`                               |
| [src/lib/stores/task-store.ts](src/lib/stores/task-store.ts)         | Add color to create/update, `deleteProject`, `updateProjectColor`                 |
| [src/App.tsx](src/App.tsx)                                           | Add Projects tab, `projectDetail` view, routing                                   |
| `src/pages/ProjectList.tsx`                                          | Create – project list, add project with color                                     |
| `src/pages/ProjectDetail.tsx`                                        | Create – task list, add task, delete project                                      |
| `src/components/DeleteProjectConfirm.tsx`                            | Create – unassign vs delete-tasks confirm                                         |
| [src/pages/TaskDetail.tsx](src/pages/TaskDetail.tsx)                 | Project badge → navigate to project detail, use color, keep picker for unassigned |
| [src/pages/TodayView.tsx](src/pages/TodayView.tsx)                   | Remove add-project block                                                          |
| [src/components/ProjectPicker.tsx](src/components/ProjectPicker.tsx) | Show project color in list (optional)                                             |
| `src/index.css`                                                      | Styles for ProjectList, ProjectDetail, color swatches, delete confirm             |


---

## 11. Implementation Order

1. Types and PROJECT_COLORS
2. DB migration and `deleteProject`
3. Store: color in create/update, `deleteProject`
4. App: add Projects tab and `projectDetail` view
5. ProjectList page with add-project (name + color)
6. ProjectDetail page (tasks, add task, delete)
7. DeleteProjectConfirm
8. TaskDetail: badge navigation + color
9. TodayView: remove add-project
10. Color swatches and styling

