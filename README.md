# SoulPlan

Open source visual planning software for sprint and release management.

## Features

- **Visual board** — releases contain sprints, sprints contain tasks, laid out left-to-right
- **Drag and drop** — move tasks between sprints by dragging (reassigns instantly)
- **Dependency lines** — connect tasks to show blockers (coming soon)
- **Capacity tracking** — per-sprint capacity with visual over-allocation warnings
- **Color coding** — critical tasks, custom colors per card
- **SQLite** — simple local persistence, no external DB needed

## Tech Stack

- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS** for styling
- **@dnd-kit** for drag-and-drop
- **better-sqlite3** for persistence
- **SQLite** database (auto-created in `data/soul-plan.db`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — a default board is auto-created on first load.

## Docker

Pre-built multi-arch images are published to GHCR on every push to `master` and on `v0.1*` tags.

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

Multi-arch: `linux/amd64` and `linux/arm64` (Apple Silicon, Raspberry Pi).

## License

MIT
