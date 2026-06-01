# SoulPlan Progress — commit 7f79641 (master)

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
- `SprintColumn`: wraps tasks in `SortableContext` with `verticalListSortingStrategy`
- `page.tsx`: `DndContext` with `PointerSensor` (5px distance activation), `handleDragStart` sets overlay task, `handleDragEnd` dispatches reorder vs cross-sprint move
- `useTaskMutations`: added `reorderTasks()` — sends parallel `PATCH /tasks` with updated `position` for each moved task
- Drag overlay: lightweight `DragOverlayTask` rendered while dragging (no sortable hooks)

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

## Remaining Work

### Feature: Zoom & Pan (Canvas Navigation)
Scrolling horizontally/vertically across many sprints and releases is cumbersome. Need Photoshop/Miro-style canvas navigation:
- **Hold Space + drag** to pan (hand tool)
- **Scroll wheel** / **pinch** to zoom in/out
- **Zoom controls**: fit-to-screen, zoom to selection, +/- buttons
- **Minimap** (optional): bird's-eye overview with viewport indicator
- Implementation: wrap the board in a zoomable/pannable container (e.g. `react-zoom-pan-pinch` or custom transform layer using CSS `transform: scale() translate()`)
- `@dnd-kit` v6+ handles zoomed containers natively via `measuring={{ draggable: { frequency: 1 } }}` — only prop change needed, no architecture shift

### Future: SVG Dependency Lines
- If badge UX proves insufficient, add SVG overlay lines between dependent tasks
- Estimated 6-10h for cross-sprint routing, hit testing, coordinate math
- Badge approach gives 80% value with 20% effort — SVG lines are a later polish

## Architecture Notes
- sql.js in-memory DB, persisted to `data/soul-plan.db` via `saveToDisk()`
- `getDb()` is module-scoped async singleton — may reset on Turbopack hot reload (known dev-mode issue)
- Frontend hooks: `useBoard()` (fetch + reload), `useTaskMutations()` (optimistic moves, CRUD, reorder)
- All DB mutations call `saveToDisk()` after write
- DnD: `DndContext` wraps board, `SortableContext` per sprint column, `useSortable` per task card