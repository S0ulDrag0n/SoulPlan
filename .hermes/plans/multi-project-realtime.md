# SoulPlan: Multi-Project + Users/Guests + Realtime Collaboration

## Branch
`feature/multi-project-realtime` (already created from master)

## Current Architecture
- Next.js 16 App Router + Tailwind v4 + sql.js (WASM SQLite) + dnd-kit
- Single-board client-side app. `boards` is the top-level entity
- Schema: boards → releases → sprints → tasks; sticky_notes + note_connections on boards
- All persistence via sql.js (WASM SQLite) loaded server-side in API routes
- API routes under `src/app/api/` (board, releases, sprints, tasks, dependencies, sticky-notes, note-connections)
- Transform layer: `src/lib/transform.ts` (row ↔ model), `src/lib/db/types.ts` (DB rows), `src/lib/types.ts` (frontend types)
- Query layer: `src/lib/queries.ts`
- DB adapter: `src/lib/db/adapter.ts` (IDatabase interface), `src/lib/db/sqlite.ts` (sql.js implementation)
- Hooks: `src/hooks/useBoard.ts`, `src/hooks/useTaskMutations.ts`
- API client: `src/lib/api.ts`
- Main page: `src/app/page.tsx`

## CRITICAL: Read AGENTS.md first!
Before writing ANY code, read `/repos/personal/SoulPlan/AGENTS.md` — it has the Next.js 16 rules, architecture patterns, and common mistakes. Also read `node_modules/next/dist/docs/` for any Next.js API questions.

## Three Features to Implement

### Feature 1: Multiple Projects with Boards
**Goal:** Projects are the new top-level entity. Each project contains one or more boards. Boards contain releases (existing hierarchy continues).

**Schema changes (migration V5):**
```sql
-- New: projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT, -- FK to users.id (nullable for migration period)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add project_id to boards
ALTER TABLE boards ADD COLUMN project_id TEXT;
```

**Code changes:**
1. `src/lib/db/types.ts` — add `ProjectRow`
2. `src/lib/db/adapter.ts` — add project CRUD methods to `IDatabase`
3. `src/lib/db/sqlite.ts` — implement project methods + V5 migration + add `project_id` to board methods
4. `src/lib/types.ts` — add `Project` type, update `BoardState` to include project info
5. `src/lib/transform.ts` — add `toProject`, update `assembleBoardState` if needed
6. `src/lib/queries.ts` — add project queries (createProject, getProjects, getProject, deleteProject)
7. `src/app/api/projects/route.ts` — GET (list all), POST (create new)
8. `src/app/api/projects/[id]/route.ts` — GET, PATCH, DELETE
9. `src/app/api/board/route.ts` — update to accept `?projectId=` or `?boardId=` param
10. `src/app/page.tsx` — add project list/switcher UI, navigate between projects

**UI approach:**
- Add a project list page or sidebar showing all projects
- Clicking a project loads its first board (or a board selector if multiple)
- "+ New Project" button (only visible to authenticated users — see Feature 2)
- Keep existing board UI intact, just nest it under a project context

### Feature 2: Users and Guests
**Goal:** Users have passwords and can create projects. Guests have names only and can join existing projects to collaborate.

**Schema changes (migration V6):**
```sql
-- Users with passwords
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Guests (name-only, no password)
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Project membership
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('user', 'guest')),
  member_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_member_unique ON project_members(project_id, member_id);
```

**Code changes:**
1. Add to types, adapter, sqlite, transform, queries — following the existing pattern
2. `src/app/api/auth/route.ts` — POST: login (user) or join (guest with name)
3. `src/app/api/auth/[id]/route.ts` — session management
4. Use simple session tokens (generate random token, store in a `sessions` table or in-memory)
5. `src/app/api/projects/route.ts` — POST requires authenticated user; guests get 403
6. Password hashing: use Node.js `crypto` (scrypt or pbkdf2) — no external deps needed
7. Client-side: store session token in localStorage, send as header

**UI approach:**
- Landing page: "Login" or "Join as Guest" (enter name)
- After login: show project list
- After guest join: show projects they're members of
- Header shows current user/guest name + role
- "+ New Project" button only for users

### Feature 3: Realtime Collaboration
**Goal:** Multiple users/guests on the same project see each other's cursors and editing activity in realtime.

**Approach: Server-Sent Events (SSE)**
Next.js API routes can support SSE (long-lived HTTP response). No WebSocket library needed.

**Architecture:**
- `src/app/api/realtime/events/route.ts` — SSE endpoint. Client connects via EventSource. Server keeps connection open and pushes events.
- `src/app/api/realtime/cursor/route.ts` — POST: client sends cursor position { x, y, boardId, memberId }
- `src/app/api/realtime/presence/route.ts` — POST: heartbeat for presence (join/leave)
- In-memory event store: `src/lib/realtime/EventBus.ts` — a singleton Map of project → connected clients, broadcasts events to all SSE connections for that project

**Event types:**
```typescript
type RealtimeEvent =
  | { type: 'cursor', memberId: string, memberName: string, x: number, y: number }
  | { type: 'presence', memberId: string, memberName: string, action: 'join' | 'leave' }
  | { type: 'editing', memberId: string, memberName: string, target: 'task' | 'sprint' | 'release', targetId: string }
  | { type: 'board-update', boardId: string, change: string }; // notify others to reload
```

**Client-side:**
- `src/hooks/useRealtime.ts` — connects to SSE, tracks presence + cursors
- `src/components/CursorOverlay.tsx` — renders other users' cursors on the PanCanvas
- `src/components/PresenceBar.tsx` — shows who's online (avatars/names in header)
- Cursor tracking: throttle mousemove on PanCanvas, POST to cursor endpoint every ~50ms
- Editing indicators: when user opens a modal (edit task/sprint/release), broadcast editing event

**Implementation order:**
1. EventBus singleton (server-side, in-memory)
2. SSE endpoint (GET with text/event-stream)
3. Cursor POST endpoint
4. Presence POST endpoint
5. Client hook (useRealtime)
6. CursorOverlay component
7. PresenceBar component
8. Wire into page.tsx

## Implementation Order (prioritized)
1. **Phase 1 — Schema + Types + Queries** (Features 1+2 schema): migrations V5+V6, types, adapter, sqlite implementation, transform, queries
2. **Phase 2 — API Routes** (Features 1+2 API): projects, auth, project members
3. **Phase 3 — UI: Project List + Auth** (Features 1+2 UI): landing page, project switcher, auth flow
4. **Phase 4 — Realtime Backend** (Feature 3 backend): EventBus, SSE, cursor/presence endpoints
5. **Phase 5 — Realtime Frontend** (Feature 3 UI): useRealtime hook, CursorOverlay, PresenceBar
6. **Phase 6 — Integration + Testing**: wire everything together, verify build passes, run existing tests

## Constraints
- ONLY work in `/repos/personal/SoulPlan` on branch `feature/multi-project-realtime`
- Do NOT touch any other repo (no work repos, no other personal repos)
- Do NOT create PRs or issues via MCP or GitHub — just commit and push the branch
- Read AGENTS.md before writing any Next.js code
- Follow the architecture-first patterns in AGENTS.md
- Use Node.js `crypto` for password hashing (no external deps)
- Use SSE for realtime (no WebSocket libraries)
- Keep existing features working (don't break DnD, sticky notes, dependency lines, etc.)
- Run `npm run build` to verify the build passes before pushing
- Run `npx tsc --noEmit` to check types before pushing
- Commit with clear, conventional commit messages (feat:, fix:, refactor:, docs:)
- Push to origin when done (or at meaningful milestones)

## Verification
After implementation:
1. `npx tsc --noEmit` — type check passes
2. `npm run build` — build succeeds
3. `npx jest` — existing tests pass
4. `git log --oneline` — review commits
5. `git push origin feature/multi-project-realtime` — push the branch

## Progress Tracking
Update `PROGRESS.md` with new feature sections as you complete them.