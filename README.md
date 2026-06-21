# SoulPlan

Open source visual planning software for sprint and release management.

## Features

- **Multi-project support** — project switcher in the header, archive/restore, delete
- **User accounts** — register and login with password hashing, or join as a guest
- **Project sharing** — invite others via reusable token-based share links
- **Realtime collaboration** — SSE-based live cursors, presence indicators, and automatic board reload on mutations
- **Visual board** — releases contain sprints, sprints contain tasks, laid out left-to-right
- **Editable board name** with live stats
- **Release navigation** — jump-to-release from the header
- **Drag and drop** — move tasks between sprints by dragging (reassigns instantly)
- **Dependency lines** — SVG Bézier curves connecting tasks to show blockers, with theme-aware coloring and click-to-delete
- **Capacity tracking** — per-sprint capacity with visual over-allocation warnings
- **Color coding** — critical tasks, custom colors per card
- **Sticky notes** — free-floating notes with polymorphic connections to tasks, sprints, or releases
- **Miro-style pan canvas** — space+drag or middle-click to pan around the board
- **Dark mode** — light / dark / system toggle with FOUC prevention

## Tech Stack

- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS v4** for styling
- **@dnd-kit** for drag-and-drop
- **sql.js** (WASM SQLite) for persistence — runs entirely in the browser, no external DB needed
- **SSE** (Server-Sent Events) for realtime collaboration
- **Node.js `crypto.scrypt`** for password hashing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register an account or join an existing project via a share link.

## Testing

```bash
npm test
# or
npx jest
```

Tests live in `src/lib/__tests__/` and cover the transform functions, auth logic, realtime EventBus, schema migrations, and query functions.

## Docker

Pre-built images are published to GHCR on every push to `master` and on `v0.1*` tags. Images are `linux/amd64` only — Tailwind CSS and Lightning CSS have cross-platform optional deps that don't build on arm64.

```bash
# Pull and run (persists the SQLite DB in a named volume)
docker run -d --name soulplan -p 3000:3000 -v soulplan-data:/app/data ghcr.io/s0uldrag0n/soulplan:latest
```

Open [http://localhost:3000](http://localhost:3000).

Or use the included `docker-compose.yml`:

```bash
docker compose up -d
```

Available tags:
- `:latest` — tracks `master`
- `:v0.1` — latest `v0.1.*` release
- `:sha-<short>` — every build, for pinning/reproducibility

## License

MIT