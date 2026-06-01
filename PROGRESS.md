# SoulPlan Progress — commit c4d672f (master)

## Completed

### Release/Sprint Full CRUD (Feature 2)
- **DB**: Added `start_date`/`end_date` columns to sprints table + `migrateV2()` for existing DBs
- **DB adapter**: Added `updateRelease(id, fields)` and `updateSprint(id, fields)` with allow-listed column updates
- **Types**: `SprintRow`/`Sprint` now have `start_date`/`startDate`, `end_date`/`endDate`. Added `UpdateReleaseInput`, `UpdateSprintInput`
- **Transform**: Added `sprintToRow()` and `releaseToRow()` reverse transforms
- **Queries**: Added `updateRelease`, `deleteRelease`, `updateSprint`, `deleteSprint` in queries.ts
- **API routes**: `PATCH/DELETE /api/releases/[id]` and `PATCH/DELETE /api/sprints/[id]`
- **API client**: `updateRelease`, `deleteRelease`, `updateSprint`, `deleteSprint` methods
- **UI**: `EditReleaseModal` (name, target date, notes), `EditSprintModal` (name, capacity, start/end dates, notes)
- **UI**: Date range display in sprint column headers (`startDate → endDate`)
- **UI**: Confirm dialog on delete actions

### UI Polish
- Sprint header: capacity badge showing used/total (e.g. `3/10pt`) next to sprint name
- Sprint header: date range + notes in subtitle, not footer
- Sprint footer: simplified to just "+ Add Task"
- Sprint/Release edit/delete: replaced emoji (✏️🗑️) with subtle text links (Edit / Delete)

### Bug Fix
- All async `q.*` query calls in route handlers were missing `await` — fixed

## Remaining Work

### Feature 1: Task Dependencies (SVG lines between tasks)
**Already exists in backend:**
- `dependencies` DB table with `from_task_id`/`to_task_id` + CASCADE
- `createDependency`/`deleteDependency` in queries.ts
- `toDependency` in transform.ts
- Dependencies included in `assembleBoardState`

**Still needed:**
- API routes: `POST/DELETE /api/dependencies/route.ts`
- API client: `createDependency(fromTaskId, toTaskId)`, `deleteDependency(id)`
- UI: SVG overlay component for dependency lines
- UI: Click-to-link interaction (select source task, then target task)
- UI: Delete dependency action (click line or button)
- Board state needs `dependencies` exposed if not already

### Feature: Task Reorder Within Sprint
- Backend fully supports it: `position` column on tasks, `UpdateTaskInput` accepts `position`, `taskToRow()` maps it
- Need: Re-add `@dnd-kit/sortable` package (was removed as unused)
- Need: `SortableContext` wrapper in `SprintColumn`, `useSortable` in `TaskCard`
- Need: Handler to PATCH updated positions after reorder

## Architecture Notes
- sql.js in-memory DB, persisted to `data/soul-plan.db` via `saveToDisk()`
- `getDb()` is module-scoped async singleton — may reset on Turbopack hot reload (known dev-mode issue)
- Frontend hooks: `useBoard()` (fetch + reload), `useTaskMutations()` (optimistic moves, CRUD)
- All DB mutations call `saveToDisk()` after write