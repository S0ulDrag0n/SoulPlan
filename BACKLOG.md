# SoulPlan — Enhancement & Cleanup Backlog

Created 2026-11-12 after landing `ui-revision` + `jira-integration`. These also
exist as card tasks in the app (project "App Maintenance — 2026-11-12", sprint
"Backlog"). Order below is by value; estimates are story points.

## Cleanup

- [ ] **Jira sync needs a live E2E pass** (5) — two-way sync passed unit tests
  but was never pointed at a real Jira site. Run one full import/export cycle
  with real credentials via the test-connection flow.
- [ ] **Jira sync test mode** (3) — a dry-run flag on `/jira/sync` so reviewers
  can see the planned diff without writing anything.
- [x] **CI** — `test.yml` already runs tsc + jest on push/PR; added the
  `next build` production gate on 2026-11-12 (docker-publish.yml existed too).
- [ ] **sql.js data safety on refresh** (5) — confirm what survives a server
  restart / multi-user use; add periodic snapshot download if needed.

## Enhancements

- [ ] **SSE auto-reconnect with backoff** (5) — exponential backoff for the
  realtime hook, plus a presence de-dup window; verify two tabs stay
  consistent after a server restart.
- [ ] **Keyboard-accessible board** (8) — dnd-kit keyboard sensor for card
  moves and cross-sprint drops; keep the dependency connector in tab order.
- [x] **Burndown chart timezone edge** (3) — fixed 2026-11-12: computation
  moved to `src/lib/burndown.ts` with date-string bucketing (evening
  completions no longer slip a day) + unit tests for the ideal/actual lines.
- [ ] **Project switch performance** (5) — cache per-project board state
  client-side with invalidation on SSE `board-update`.
- [ ] **Touch/mobile board check** (3) — PointerSensor drag on phones,
  glassmorphism contrast in sunlight, sticky-note flow on small viewports.
