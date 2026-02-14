---
name: Single Task View Migration
overview: Consolidate TodayView and TaskList into a single task view by enhancing TodayView with isAdding and error handling from TaskList, then removing the Tasks tab, TaskList page, and unused components.
todos: []
isProject: false
---

# Single Task View Migration

## Summary

Merge the Today and Tasks views into one. TodayView becomes the sole task list. Add `isAdding` and error state from TaskList. Remove the Tasks tab, TaskList page, and ExpandableTaskRow (only used by TaskList).

## Changes

### 1. Enhance TodayView with TaskList behaviors

**File:** [src/pages/TodayView.tsx](src/pages/TodayView.tsx)

- Add `error` and `isLoading` from `useTaskStore()`:
  ```ts
  const { tasks, projects, isLoading, error } = useTaskStore();
  ```
- Add `isAdding` state and wrap `handleAddTask`:
  ```ts
  const [isAdding, setIsAdding] = useState(false);
  // In handleAddTask: setIsAdding(true); try { ... } finally { setIsAdding(false); }
  ```
- Add early returns for error and loading (before main content):
  ```ts
  if (error) return <div className="today-view__error">Error: {error}</div>;
  if (isLoading) return <div className="today-view__loading">Loading tasks...</div>;
  ```
- In quick-add form: `disabled={isAdding}` on input, `disabled={isAdding || !newTaskTitle.trim()}` on button.

### 2. Add error/loading styles to TodayView

**File:** [src/styles/components/today-view.css](src/styles/components/today-view.css)

Add classes matching TaskList pattern (or reuse if similar):

- `.today-view__error` - padding, text-align center, color for errors (e.g. `var(--color-recording)` or similar)
- `.today-view__loading` - padding, text-align center, muted color

Reference: [src/styles/components/task-list.css](src/styles/components/task-list.css) lines 11-19 for loading/error styles.

### 3. Remove Tasks tab and TaskList from App

**File:** [src/App.tsx](src/App.tsx)

- Remove `TaskList` import.
- Change `Tab` type: `'today' | 'tasks' | 'projects'` → `'today' | 'projects'`.
- Remove the `view.tab === 'tasks'` branch and `<TaskList />` render.
- Remove the Tasks tab button (lines 132-140).
- Ensure `currentTab` and `returnTab` never reference `'tasks'`; when `currentTab` would be `'tasks'`, treat as `'today'` or ensure no code path sets it (with the tab removed, users cannot reach it; for `returnTab` from TaskDetail, it is derived from `currentTab`, so no fix needed once tab is gone).

### 4. Delete TaskList page

**File:** [src/pages/TaskList.tsx](src/pages/TaskList.tsx)

- Delete the file.

### 5. Delete ExpandableTaskRow (optional cleanup)

**File:** [src/components/ExpandableTaskRow.tsx](src/components/ExpandableTaskRow.tsx)

- TaskList is the only consumer. Delete the component.
- Remove `.expandable-task-row__subtasks` rules from [src/styles/components/task-row.css](src/styles/components/task-row.css) and [src/styles/_dark.css](src/styles/_dark.css) if they only serve ExpandableTaskRow. Check: `task-row.css` line 192 and `_dark.css` lines 28-29 reference expandable-task-row; remove or simplify if unused.

### 6. Remove task-list.css import

**File:** [src/index.css](src/index.css)

- Remove `@import './styles/components/task-list.css';` (line 19).

### 7. Delete task-list.css

**File:** [src/styles/components/task-list.css](src/styles/components/task-list.css)

- Delete the file (no longer imported).

### 8. Update useCompletionFlow comment

**File:** [src/lib/hooks/useCompletionFlow.ts](src/lib/hooks/useCompletionFlow.ts)

- Change "Shared completion logic for list views (TodayView, TaskList)" to "Shared completion logic for list views (TodayView)".

---

## Navigation / Tab type

After migration, tabs are Today and Projects only. `ReturnTo` and `View` types still allow `tab: Tab`; since `Tab` no longer includes `'tasks'`, all paths are valid. No navigation edge cases from removing the Tasks tab.

## Files Summary


| Action | File                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| Edit   | `src/pages/TodayView.tsx` - add isAdding, error, loading                      |
| Edit   | `src/styles/components/today-view.css` - add error/loading styles             |
| Edit   | `src/App.tsx` - remove TaskList, Tasks tab, update Tab type                   |
| Edit   | `src/index.css` - remove task-list import                                     |
| Edit   | `src/lib/hooks/useCompletionFlow.ts` - update comment                         |
| Delete | `src/pages/TaskList.tsx`                                                      |
| Delete | `src/components/ExpandableTaskRow.tsx`                                        |
| Delete | `src/styles/components/task-list.css`                                         |
| Edit   | `src/styles/components/task-row.css` - remove expandable-task-row if orphaned |
| Edit   | `src/styles/_dark.css` - remove expandable-task-row if orphaned               |


