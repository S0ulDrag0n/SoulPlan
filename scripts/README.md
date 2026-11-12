
# Scripts

## seed_maintenance_board.py
Creates the maintenance/Enhancement & Cleanup backlog as a real board
(project "App Maintenance — 2026-11-12", sprint "Backlog"). Mirrors
BACKLOG.md. Run against any running instance:

    SOULPLAN_BASE=http://your-host:3000 python3 scripts/seed_maintenance_board.py

Idempotency is per-user: it logs in e2e_user (creates it on first run).
Change the credentials in the login call for a permanent instance.

## e2e_smoke.sh
13-step API smoke: auth, project, release, sprint, tasks, dependency +
duplicate-409, burndown, Jira auth-gates, SSE presence/cursor. Run:

    SOULPLAN_BASE=http://your-host:3000 bash scripts/e2e_smoke.sh
