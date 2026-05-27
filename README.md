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

## License

MIT