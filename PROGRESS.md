# SoulPlan Progress

## Completed Features

### Drag & Drop Sprint Reordering ✅
- dnd-kit with PointerSensor (5px activation distance)
- Optimistic reorder within sprints via `arrayMove`
- Cross-sprint drag-and-drop with position-aware insert
- DragOverlay ghost card with task color indicator
- Position-aware insert for cross-sprint drops

### Dependency System ✅
- Tasks can depend on other tasks (from→to)
- Dependency badges on task cards showing blocking/blocked-by counts
- Click badge to jump to related task (scrollIntoView)
- Orange "blocks" badges, blue "blocked by" badges
- EditTaskModal dependency management with multi-select

### SVG Dependency Lines ✅
- Cubic Bézier curves from right-center of source to left-center of target
- Triangle arrowheads at target end
- Dashed stroke style with transparency
- Re-draws on resize, after drag/pan, and on theme changes
- Dark mode line color adapts (slate-400 in light, slate-500 in dark)
- MutationObserver watches `<html>` class changes for instant theme redraw

### Miro-Style Pan Canvas ✅
- Space+drag to pan around the board (Miro-style)
- Middle-click drag as alternative pan gesture
- Visual hint popup on first interaction
- Cursor feedback (grab/grabbing)
- `stopPropagation()` prevents pan from triggering dnd-kit drag
- DndContext wraps PanCanvas; DragOverlay outside transform to avoid double-offset
- GPU-accelerated via `will-change: transform`

### Dark Mode ✅
- Three-way toggle: Light → Dark → System (cycles on click)
- `ThemeProvider` context with `localStorage` persistence (`soulplan-theme` key)
- `ThemeToggle` component with sun/moon icons + system dot indicator
- FOUC prevention: inline `<script>` in `<head>` reads localStorage and adds `dark` class before render
- Tailwind v4 `@custom-variant dark` for class-based toggling
- Applied across all components:
  - Page layout, header, task cards, sprint columns
  - Release blocks with hover states
  - All modal dialogs (EditTask, EditRelease, EditSprint)
  - Dependency line colors adapt to theme
  - DragOverlay ghost card
  - Scrollbar styling
- `transition-colors` on main layout for smooth theme switching

### Error Handling & Resilience ✅
- CRUD operations show error toasts
- Mutation error banner at top of page
- EditTaskModal clears error on retry
- EditSprintModal handles falsy-zero capacity correctly
- 409 Conflict handling on dependency creation

### Tech Debt Sprint ✅
- sqlite.ts V3 migration with column validation
- API route normalization (sprints, dependencies)
- useBoard.ts: eliminated dead code and stale closures
- adapter.ts: direct DB access, consistent error mapping
- useTaskMutations: error state + toast feedback

### ConnectionLines Refactor ✅
- Extracted generic SVG line renderer from `DependencyLines` into `ConnectionLines`
- Domain-agnostic core: Bézier/loop-arc geometry, theme-aware coloring, click-to-delete hit areas, resize/theme/pan redraw observers
- Declarative `ConnectionSpec` API: callers pass CSS selectors, no DOM-lookup coupling
- `commonAncestorSelector` generalizes the same-sprint loop-arc test for future connection types
- `DependencyLines` is now a 30-line adapter; no public API change; `page.tsx` untouched

### Sticky Notes (Miro-lite) ✅
- Free-floating notes anywhere on the board canvas with `(x, y)` in pan-space
- Polymorphic connections: note → task | sprint | release
- Drag from the right-edge handle on a note to drop a connection line
- Inline contenteditable text (double-click body)
- Header-drag to move; shift+click to cycle color (yellow/pink/blue/green/purple)
- Cascade cleanup: deleting a release cleans up connections to its sprints/tasks too
- Same `ConnectionLines` core renders both dependency lines and note lines, with different colors
- `data-release-id` added to `ReleaseBlock` so the line system can find release elements

## Architecture
- **Stack**: Next.js 16 App Router (Turbopack), sql.js (WASM), Tailwind CSS v4, dnd-kit
- **Database**: V6 migration adds users, guests, project_members, sessions tables; V5 adds projects table + project_id on boards
- **State**: React state + optimistic updates + background API sync
- **Realtime**: SSE (Server-Sent Events) via in-memory EventBus singleton — no WebSocket libraries
- **Auth**: scrypt password hashing (Node.js crypto), session tokens stored in DB
- **Build Note**: Root-owned repo — push via GitHub MCP API only, never `mcp_github_push_files` (corrupts JSX)

## Multi-Project + Users/Guests + Realtime Collaboration ✅

### Multiple Projects ✅
- Projects are the new top-level entity containing boards
- V5 migration: projects table + project_id column on boards
- ProjectSwitcher dropdown in header for switching between projects
- Project CRUD API: GET/POST /api/projects, GET/PATCH/DELETE /api/projects/[id]
- /api/board endpoint accepts ?boardId= and ?projectId= params
- Backward compatible: unauthenticated users get the default project/board

### Users and Guests ✅
- Users have passwords (scrypt hash), guests have names only
- V6 migration: users, guests, project_members, sessions tables
- Auth API: POST /api/auth (register/login/guest), GET (verify), DELETE (logout)
- AuthProvider context manages session state via localStorage
- AuthForm component: tabbed login/register/guest-join modal
- Only users can create projects (guests get 403)
- Project members API: GET/POST /api/projects/[id]/members, DELETE member
- Session token sent as Bearer header with all API requests
- Header shows current user/guest name + logout button

### Realtime Collaboration ✅
- Server-Sent Events (SSE) — no WebSocket libraries needed
- EventBus singleton: in-memory map of project → connected SSE clients
- SSE endpoint: GET /api/realtime/events?projectId=X (force-dynamic, text/event-stream)
- Cursor endpoint: POST /api/realtime/cursor — broadcast { x, y } to project
- Presence endpoint: POST /api/realtime/presence (join/leave), GET (list)
- Editing endpoint: POST /api/realtime/editing — broadcast editing indicators
- useRealtime hook: connects to SSE, tracks cursors/presence/editing
  - Throttled cursor sending (~50ms), stale cursor cleanup (10s timeout)
  - Presence join/leave, editing indicators with 30s expiry
  - Token passed as query param (EventSource can't send headers)
- CursorOverlay: colored remote cursors with name labels, smooth transitions
- PresenceBar: avatar stack in header showing who's online with count
- Event types: cursor, presence (join/leave), editing, board-update
- All realtime endpoints require authentication