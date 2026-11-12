/**
 * Two-way sync engine between SoulPlan and Jira.
 * Last-write-wins strategy for v1 — no complex conflict resolution.
 */
import type { IDatabase } from '../db/adapter';
import { JiraClient } from './client';
import { decryptToken } from './crypto';
import { toJiraConfig, toJiraSyncLog } from '../transform';
import { randomUUID } from 'crypto';
import type { JiraConfig, JiraSyncLog, JiraIssue } from '../types';

export interface SyncResult {
  imported: number;
  exported: number;
  skipped: number;
  errors: number;
  logs: JiraSyncLog[];
}

export async function runSync(db: IDatabase, projectId: string): Promise<SyncResult> {
  const configRow = await db.getJiraConfig(projectId);
  if (!configRow) throw new Error('Jira not configured for this project');

  const config = toJiraConfig(configRow);
  const apiToken = configRow.encrypted_token
    ? decryptToken(configRow.encrypted_token)
    : configRow.api_token ?? '';

  const client = new JiraClient({
    baseUrl: config.baseUrl,
    email: config.email,
    apiToken,
    jiraType: config.jiraType,
    boardId: config.boardId,
  });

  const result: SyncResult = { imported: 0, exported: 0, skipped: 0, errors: 0, logs: [] };

  // Import: pull Jira issues and update linked tasks
  try {
    const issues = config.boardId
      ? await client.getEpicIssues(config.boardId)
      : await client.searchEpics();

    for (const issue of issues) {
      try {
        await importIssue(db, projectId, issue, result);
        result.imported++;
      } catch (err) {
        result.errors++;
        const log = await db.insertSyncLog(
          randomUUID(), projectId, 'import', 'task',
          null, issue.id, 'error', (err as Error).message
        );
        result.logs.push(toJiraSyncLog(log));
      }
    }
  } catch (err) {
    result.errors++;
    const log = await db.insertSyncLog(
      randomUUID(), projectId, 'import', 'task',
      null, null, 'error', (err as Error).message
    );
    result.logs.push(toJiraSyncLog(log));
  }

  // Export: push SoulPlan task changes to Jira for linked tasks
  try {
    const boards = await db.getBoardsByProjectId(projectId);
    for (const board of boards) {
      const releases = await db.getReleasesByBoardId(board.id);
      for (const release of releases) {
        const sprints = await db.getSprintsByReleaseIds([release.id]);
        const sprintIds = sprints.map(s => s.id);
        const tasks = await db.getTasksBySprintIds(sprintIds);
        for (const task of tasks) {
          const taskAny = task as unknown as Record<string, unknown>;
          if (taskAny.jira_issue_key) {
            try {
              await exportTask(db, projectId, client, taskAny.jira_issue_key as string, task as unknown as Record<string, unknown>, result);
              result.exported++;
            } catch (err) {
              result.errors++;
              const log = await db.insertSyncLog(
                randomUUID(), projectId, 'export', 'task',
                task.id, taskAny.jira_issue_key as string, 'error', (err as Error).message
              );
              result.logs.push(toJiraSyncLog(log));
            }
          }
        }
      }
    }
  } catch (err) {
    result.errors++;
  }

  // Update last_synced_at
  await db.updateJiraConfig(configRow.id, { last_synced_at: new Date().toISOString() });

  return result;
}

async function importIssue(
  db: IDatabase,
  projectId: string,
  issue: JiraIssue,
  result: SyncResult
): Promise<void> {
  // Find existing task linked to this Jira issue
  const boards = await db.getBoardsByProjectId(projectId);
  let found = false;

  for (const board of boards) {
    const releases = await db.getReleasesByBoardId(board.id);
    for (const release of releases) {
      const sprints = await db.getSprintsByReleaseIds([release.id]);
      const sprintIds = sprints.map(s => s.id);
      const tasks = await db.getTasksBySprintIds(sprintIds);
      for (const task of tasks) {
        const taskAny = task as unknown as Record<string, unknown>;
        if (taskAny.jira_issue_key === issue.key) {
          // Update the task with Jira data
          await db.updateTask(task.id, {
            title: issue.summary,
            jira_status: issue.status,
          });
          const log = await db.insertSyncLog(
            randomUUID(), projectId, 'import', 'task',
            task.id, issue.id, 'updated', `Synced from Jira: ${issue.key}`
          );
          result.logs.push(toJiraSyncLog(log));
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) break;
  }

  if (!found) {
    result.skipped++;
    const log = await db.insertSyncLog(
      randomUUID(), projectId, 'import', 'task',
      null, issue.id, 'skipped', `No linked task for Jira issue ${issue.key}`
    );
    result.logs.push(toJiraSyncLog(log));
  }
}

async function exportTask(
  db: IDatabase,
  projectId: string,
  client: JiraClient,
  jiraKey: string,
  task: Record<string, unknown>,
  result: SyncResult
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (task.title) fields.summary = task.title;
  if (task.description !== undefined) fields.description = task.description;

  if (Object.keys(fields).length > 0) {
    await client.updateIssue(jiraKey, fields);
    const log = await db.insertSyncLog(
      randomUUID(), projectId, 'export', 'task',
      task.id as string, jiraKey, 'updated', `Pushed to Jira: ${jiraKey}`
    );
    result.logs.push(toJiraSyncLog(log));
  } else {
    result.skipped++;
  }
}