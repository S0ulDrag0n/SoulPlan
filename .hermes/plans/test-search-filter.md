# Test Plan: Search & Filter Feature

**Branch:** `feature/search-filter`
**Repo:** `/repos/personal/SoulPlan`

## Overview
Search bar with Ctrl+K shortcut, filter bar (status/sprint/Jira), and task dimming for sprint filter. Status and Jira filters are intentional no-ops (pre-built UI for future feature branches).

## Prerequisites
1. `cd /repos/personal/SoulPlan && git checkout feature/search-filter`
2. Clean any stale `.next` cache: `rm -rf .next`
3. Start dev server: `PORT=3001 npx next dev` (background, notify_on_complete=true)
4. Wait for server to be ready (poll http://localhost:3001 until it responds)

## Phase 1: Setup — Register & Populate Board
1. Navigate to `http://localhost:3001`
2. Register a new user (unique username like `testuser_<timestamp>`)
3. Create a new project (e.g., "Test Project")
4. Via the UI or API:
   - Create a release (e.g., "Release 1")
   - Create 2 sprints ("Sprint Alpha", "Sprint Beta")
   - Create 8+ tasks with varied names across both sprints:
     - "Setup database schema"
     - "Build API endpoints"
     - "Deploy to staging"
     - "Write tests"
     - "Design login page"
     - "Configure CI/CD"
     - "Implement auth guard"
     - "Database migration script"
5. Note the project ID and sprint IDs for API calls

## Phase 2: Search Bar — Basic Search
1. Find the search bar in the header area
2. Type "database" — should show results matching "Setup database schema" and "Database migration script"
3. Type "API" — should show "Build API endpoints"
4. Type "deploy" — should show "Deploy to staging"
5. Type "xyz" — should show "No matching tasks" or empty state
6. Type "t" — should show partial matches (multiple results)
7. Verify each search result shows task title + sprint context

## Phase 3: Search Bar — Ctrl+K Shortcut
1. Press Ctrl+K — search input should be focused
2. Verify `document.activeElement` is the search input (run in browser console)

## Phase 4: Search Bar — Result Click & Keyboard Nav
1. Click a search result — should open Edit Task modal for that task; search bar should clear
2. Close modal, search again
3. Use Arrow Down key to navigate results, press Enter — should open correct task
4. Verify the correct task opens (title matches)

## Phase 5: Filter Bar — Sprint Filter
1. Locate the filter bar (should appear in project header)
2. Select a sprint from the sprint dropdown (e.g., "Sprint Alpha")
3. Verify tasks in Sprint Alpha are at full opacity, tasks in Sprint Beta are dimmed (opacity ~0.3)
4. Check computed styles to verify dimming (getComputedStyle on a dimmed task card)
5. Switch to "Sprint Beta" — dimming should flip
6. Clear the sprint filter — all tasks should be at full opacity

## Phase 6: Filter Bar — Status & Jira Toggles
1. Toggle status filter — UI should highlight, Clear button should appear
   - Note: This is an intentional no-op on this branch (no filtering happens)
2. Toggle Jira filter — UI should highlight blue, Clear button should appear
   - Note: Also an intentional no-op on this branch
3. Click Clear button — all filters should reset, Clear button should disappear

## Phase 7: Regression Tests
1. Create a sticky note — should work normally
2. Click "+Task" button on a sprint — new task should appear
3. Open Edit modal for a task — should work normally
4. Click a task card — TaskDetailPanel should open (from merged master feature)
5. Check board summary / stats update correctly after changes

## Phase 8: Console Errors
1. Check `browser_console` after each phase
2. Verify ZERO JavaScript errors throughout all testing
3. Report any warnings

## Report Format
For each phase, report:
- ✅ / ❌ status
- What was tested
- What was observed
- Any bugs found (with steps to reproduce)
- Any console errors

If bugs are found:
1. Read the relevant source file
2. Identify the root cause
3. Fix the bug
4. Run `npx tsc --noEmit` to verify TypeScript is clean
5. Run `npx jest --silent` to verify tests pass
6. Commit the fix with a descriptive message

## Cleanup
1. Kill the dev server
2. Report final summary