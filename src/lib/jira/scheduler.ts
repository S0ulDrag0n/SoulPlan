/**
 * Auto-sync scheduler — polls Jira at a 5-minute interval.
 * Only runs for projects with auto_sync enabled.
 */
import { runSync } from './sync';
import { getDb } from '../db/sqlite';
import type { JiraSyncLog } from '../types';

let intervalId: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function startScheduler(): void {
  if (intervalId) return;
  intervalId = setInterval(pollAllProjects, POLL_INTERVAL);
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function pollAllProjects(): Promise<void> {
  try {
    const db = await getDb();
    const projects = await db.getAllProjects();

    for (const project of projects) {
      const config = await db.getJiraConfig(project.id);
      if (config && config.auto_sync === 1) {
        try {
          await runSync(db, project.id);
        } catch (err) {
          console.error(`Jira auto-sync failed for project ${project.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Jira scheduler poll error:', err);
  }
}