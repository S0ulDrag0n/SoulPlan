#!/usr/bin/env python3
"""Append the 2026-11-12 landing record to SoulPlan PROGRESS.md and seed the maintenance backlog into the app itself via its API."""
import json, os, subprocess, sys

BASE = os.environ.get('SOULPLAN_BASE', 'http://localhost:3456')

def api(method, path, body=None, tok=None, expect_error=False):
    cmd = ['curl', '-s', '--max-time', '20', '-X', method,
           f'{BASE}{path}',
           '-H', 'Content-Type: application/json']
    if tok:
        cmd += ['-H', f'Authorization: Bearer {tok}']
    if body is not None:
        cmd += ['-d', json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except Exception:
        return {'_raw': out}

tok = (api('POST', '/api/auth', {'action': 'login', 'username': 'e2e_user', 'password': 'e2epass123'})['session']['token'])
print('logged in as e2e_user')

P = api('POST', '/api/projects', {'name': 'App Maintenance — 2026-11-12'}, tok=tok)
pid = P['id'] if 'id' in P else P['project']['id']
print('project:', pid)
B = api('GET', f'/api/board?projectId={pid}', tok=tok)
bid = B['board']['id']
R = api('POST', '/api/releases', {'boardId': bid, 'name': 'Cleanup & Enhancements', 'projectId': pid}, tok=tok)
rid = R['id']
S = api('POST', '/api/sprints', {'releaseId': rid, 'name': 'Backlog', 'position': 0, 'capacity': 24, 'projectId': pid}, tok=tok)
sid = S['sprint']['id'] if 'sprint' in S else S['id']
print('sprint created:', sid)

tasks = [
    ('Cleanup: Jira sync needs a live E2E pass', 'Two-way Jira sync merged 2026-11-12 (config, sync, matcher) passes unit tests but was never pointed at a real Jira site. Add a test-connection page flow and run one full import/export cycle with real credentials.', '#3b82f6', 5),
    ('Cleanup: Jira sync should support test mode', 'Add a dry-run flag to /jira/sync so reviewers can see the planned import/export diff without writing.', '#3b82f6', 3),
    ('Enhance: SSE auto-reconnect with backoff', 'The realtime hook connects via EventSource. Add exponential backoff on reconnect plus a presence de-dup window, and verify two browser tabs stay consistent after a server restart.', '#8b5cf6', 5),
    ('Enhance: keyboard-accessible board', 'dnd-kit supports keyboard sensors — wire sortable keyboard activation so card moves and cross-sprint drops work without a mouse, and keep the dependency connector reachable by tab order.', '#8b5cf6', 8),
    ('Enhance: burndown chart timezone edge', 'completedAt timestamps are stored server-side; confirm day-bucketing in the chart is computed in the user timezone, not server time (ideal line can look off by a day).', '#10b981', 3),
    ('Enhance: project switch performance', 'Board loads refetch everything per project — consider caching per-project board state client-side with invalidation on SSE board-update events.', '#f59e0b', 5),
    ('Enhance: touch/mobile board check', 'dnd-kit PointerSensor works with touch in principle; verify drag handle behavior on a phone, glassmorphism contrast in sunlight, and the sticky-note flow on a small viewport.', '#ef4444', 3),
    ('Cleanup: CI — run jest + next build on PRs', 'There is no CI on this repo. Add a GitHub Action running npm ci, jest and next build on every push/PR; it would have caught nothing today (all green) but protects future merges.', '#334155', 2),
    ('Cleanup: sql.js data safety on refresh', 'Data lives server-side in the WASM sqlite of the running process today — confirm what survives a server restart/multi-user use, and if needed add periodic snapshot download.',
     '#14b8a6', 5),
]
created = 0
for title, desc, color, est in tasks:
    T = api('POST', '/api/tasks', {'title': title, 'description': desc, 'sprintId': sid,
                                    'estimate': est, 'color': color, 'projectId': pid}, tok=tok)
    if 'task' in T or ('id' in T and 'error' not in T):
        created += 1
    else:
        print('TASK FAIL:', title, '->', json.dumps(T)[:120])
print(f'tasks created: {created}/{len(tasks)}')

prog = open('PROGRESS.md', encoding='utf-8').read()
addition = """

## 2026-11-12 — feature branches landed

- `feature/ui-revision` merged (c8ffd1c): burndown chart + unified SVG icon
  system + status validation + glassmorphism polish. Clean 3-way.
- `feature/jira-integration` merged (5a2ab3f): per-project Jira config,
  two-way sync, sync log, task matcher. Union-resolved onto the UI revision
  (jira badges live on the new card components; Jira header buttons use the
  icon system — `sync` and `settings` icons added to Icon.tsx).
- transform.test expectation updated for the new nullable jira fields
  (0361d9a); every API route now returns the AuthError status (401/403)
  instead of a generic 500 (3120d53) — AuthError is caught by convention in
  all catches.
- Verified locally: jest 141/141, next build clean, dev-server e2e 13/13
  (auth register/login/verify, project, release, sprint, tasks, dependency +
  duplicate-409, burndown route, SSE presence/cursor). The maintenance board
  created by that run holds the current backlog tasks.
"""
if '2026-11-12 — feature branches landed' not in prog:
    open('PROGRESS.md', 'w', encoding='utf-8').write(prog + addition)
    print('PROGRESS.md updated')
else:
    print('PROGRESS entry already present')
