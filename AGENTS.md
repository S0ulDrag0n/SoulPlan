<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# SoulPlan — Agent Context

What follows is per-user, per-agent knowledge for working on this repo. The
Next.js warning above is the only project-managed rule. Everything else is
a working note for future agents (and future me).

## What this app is

A planning/sprint board for personal project task management. Think Trello +
dependency graph. Tasks belong to sprints, can have dependencies on other tasks,
can be dragged across sprints with optimistic reordering. Built as a single-page
Next.js 16 app with sql.js (WASM SQLite) as the data layer — no server-side DB,
runs entirely in the browser.

## Stack

- **Next.js 16** — see the warning above. Read `node_modules/next/dist/docs/`
  before writing any code.
- **Tailwind v4** — class-based dark mode via `@custom-variant dark`. Three
  themes: light / dark / system. Toggle component is `ThemeToggle`.
- **sql.js** (WASM SQLite) — all persistence is client-side. Schema lives in
  the `data/` directory. Database file is downloaded/uploaded by the user.
- **dnd-kit** — PointerSensor with 5px activation distance. DragOverlay
  outside DndContext to avoid double-offset.
- **TypeScript** strict, but the codebase is small and patterns are conventional.

## Architecture-first patterns (the ones that matter)

These are the patterns I keep getting wrong and the user keeps correcting.
Read this section before touching the relevant area of the code.

### Drag & drop

- **Drag handle only**: `SortableTaskCard` should only initiate drag from the
  designated handle, not the whole card. The whole card has click handlers
  (open modal, navigate) that conflict with drag.
- **dnd-kit's `arrayMove`** for optimistic reorder within a sprint. Don't
  manually splice — use the helper.
- **DragOverlay** must be rendered *outside* the `DndContext` to avoid a
  double-translate offset when the overlay and the source are in the same
  transform context.

### Dependency lines (SVG)

- Use `svg.getBoundingClientRect()` to compute coords, not the SVG's parent
  container's rect. The SVG may be transformed/scaled, and only the SVG's own
  rect reflects its coordinate system.
- Cubic Bézier curves, dashed stroke. Re-draw on resize, drag/pan, and theme
  change. `MutationObserver` watches `<html>` class for instant dark-mode
  redraw — no waiting for next React render.
- Smart edge selection: lines should not visually overlap their source/target
  node's edges. Compute and pick the best side per endpoint.

### Pan canvas (Miro-style)

- **Space + drag** to pan, OR **middle-click + drag**. Provide a visual hint on
  first interaction.
- Cursor: `grab` / `grabbing` for affordance.
- `stopPropagation()` on the pan handler to prevent dnd-kit from also seeing
  the gesture.
- `will-change: transform` on the panned element for GPU acceleration.

### State management

- Heavy use of `useState` + small context providers (ThemeProvider, etc.).
  No Redux / Zustand. The state surface is small enough that prop-drilling +
  context is fine.
- All references for stable event listeners (pan, observer). Don't recreate
  handlers on every render.

### Theming

- `localStorage` key: `soulplan-theme`. FOUC prevention: inline `<script>` in
  `<head>` reads localStorage and adds the `dark` class before React hydrates.
- Three values: `"light" | "dark" | "system"`. The toggle cycles through them.
- Dark mode line colors: `slate-400` (light) / `slate-500` (dark).

## Build / deploy

- **GHCR**: publish `linux/amd64` only. No arm64 builds — Tailwind CSS and
  Lightning CSS have cross-platform optional deps that fail on win32 hosts.
- **Docker**: the Dockerfile `RUN`s as root to `mkdir + chown` writable dirs
  (e.g. `/app/data`) BEFORE switching to USER `appuser`. This is required
  because the volume mount at `/app/data` would otherwise be owned by root
  and unwritable to `appuser`.
- **NPM**: use `npm i -g npm@latest` to upgrade before cross-platform
  install. Default `npm@9` + Tailwind 4 hits `EBADPLATFORM` on Windows.

## Things I (the agent) keep getting wrong

- **Re-deriving version numbers from training data**. The Next.js version here
  is whatever `node_modules/next/package.json` says — don't guess.
- **Asserting that "user shipped commits between sessions" based on
  `session_search` results**. `session_search` shows my own past-session
  work too. Always `git log --oneline origin/master` and check the **author**
  of new commits before assuming user-shipped work.
- **Trusting imports that look like they should work**. `import` paths
  change between Next major versions. Grep for the actual import paths in
  the current code before adding a new file's import.
- **Trying to call MCP write tools on this repo** without checking which
  write scope applies. Personal repos (S0ulDrag0n) = can push code freely,
  but DO NOT create/modify/delete issues/PRs/etc. without asking. Read-only
  is always fine.

## Where to look first when working on this repo

1. `PROGRESS.md` — what's been built, in human-readable feature list form.
2. The `<!-- BEGIN/END:nextjs-agent-rules -->` block at the top of this file
   — Next.js version rules.
3. This file's "Architecture-first patterns" section — patterns + common
   mistakes.
4. `node_modules/next/dist/docs/` — for any Next.js API question.
5. `git log --oneline -20` — recent changes give a sense of what's been
   touched and why.
