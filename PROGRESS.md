# SoulPlan Progress — latest (master)

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

### Task Reorder Within Sprint
- Package: `@dnd-kit/sortable` added for sortable drag-and-drop
- `SortableTaskCard` component: wraps task card with `useSortable` hook, handles transform/transition/drag styles
- Source card hidden during drag (opacity: 0), CSS transition disabled during drag (transition: none)
- `SprintColumn`: wraps tasks in `SortableContext` with `verticalListSortingStrategy`, `useDroppable` for drop target
- `page.tsx`: `DndContext` with `PointerSensor` (5px distance activation), `handleDragStart` sets overlay task, `handleDragEnd` dispatches reorder vs cross-sprint move
- `useTaskMutations`: added `reorderTasks()` — sends sequential `PATCH /tasks` with updated `position` for each moved task

### Cross-Sprint Drag & Drop (Position-Aware)
- `resolveDropTarget()` in transform.ts: returns `{ sprintId, insertIndex }` — drops on task → insert before it, drops on sprint column → append to end
- `moveTaskBetweenSprints()` in transform.ts: inserts task at `insertIndex` in target sprint, removes from source, reindexes positions in both sprints
- `moveTask()` in useTaskMutations: optimistic update via `setBoardState` before API calls, then sends PATCH for moved task + position updates for all affected tasks in target and source sprints
- `handleDragEnd` dispatches same-sprint reorder vs cross-sprint move based on `activeSprintId === targetSprintId`
- Known minor rough edge: cross-sprint position detection works but isn't pixel-perfect — acceptable for now

### Task Dependencies (Badge UI + CRUD)
- **API route**: `POST/DELETE /api/dependencies` — create (with self-ref validation) and delete dependencies
- **API client**: `createDependency(fromTaskId, toTaskId)`, `deleteDependency(id)`
- **TaskCard badges**: orange "← blocked" chips for incoming deps, blue "→ blocks" chips for outgoing deps
- **Badge click**: `onJumpToTask` opens the dependent task's edit modal
- **EditTaskModal dependency section**:
  - Shows "Blocked by" (orange) and "Blocks" (blue) chips with × remove buttons
  - Two dropdown selectors: "Blocks →" (blue) and "← Blocked by" (orange)
  - Real-time add/remove with board refresh after each mutation
  - Task titles shown in chips; dropdown shows all other tasks across the board

### Toast Notifications
- Success/error toast on task CRUD operations
- Toast auto-dismisses; re-fetch on error to revert optimistic updates

### Empty States
- Empty sprint columns show helpful placeholder text

### "+ Task" Button
- Fixed position in sprint header, doesn't shift when tasks are added

## Remaining Work

### Low Priority Polish
- **Horizontal scroll for overflowed dependency tags** — minor cosmetic when many deps on one task

### Fixed Architecture Debt
- **API race condition** — replaced `Promise.all` with sequential `for...of await` in `moveTask` and `reorderTasks`. PATCH calls now execute in order, preventing position clobbering under rapid use.
- **Stale `boardState` closure** — both `page.tsx` and `useTaskMutations.ts` now use `useRef(boardState)` with `boardStateRef.current = boardState` on every render. Async DnD handlers always read the latest state, preventing stale state on rapid drags.
- **No-op ternary** — cleaned `insertIndex > oldIndex ? insertIndex : insertIndex` to just `insertIndex` with a comment explaining `arrayMove` semantics.

### Low Priority Polish
- **Zoom & Pan** — not needed until 10+ sprints. `@dnd-kit` v6+ handles zoomed containers natively, no architecture shift required.
- **SVG dependency lines** — badges give 80% value with 20% effort. SVG lines are polish for later (6-10h estimated).

## Architecture Notes
- sql.js in-memory DB, persisted to `data/soul-plan.db` via `saveToDisk()`
- `getDb()` is module-scoped async singleton — may reset on Turbopack hot reload (known dev-mode issue)
- Frontend hooks: `useBoard()` (fetch + reload), `useTaskMutations()` (optimistic moves, CRUD, reorder)
- All DB mutations call `saveToDisk()` after write
- DnD: `DndContext` wraps board, `SortableContext` per sprint column, `useSortable` per task card, `useDroppable` per sprint column for cross-sprint drops
- **Important**: Must push via `mcp_github_create_or_update_file` — NOT `mcp_github_push_files` (corrupts JSX/TSX). Local repo is root-owned, cannot run `tsc`/`next build`.