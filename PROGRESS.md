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

## Architecture
- **Stack**: Next.js 16 App Router (Turbopack), sql.js (WASM), Tailwind CSS v4, dnd-kit
- **Database**: `sql.sql` schema, V3 migration with column validation
- **State**: React state + optimistic updates + background API sync
- **Build Note**: Root-owned repo — push via GitHub MCP API only, never `mcp_github_push_files` (corrupts JSX)