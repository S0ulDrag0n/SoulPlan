/**
 * Jira REST API client — supports both Cloud and Server/Data Center.
 * Uses REST API v2 for issues and Agile API for boards/sprints.
 */
import type { JiraSprint, JiraIssue } from '../types';

export interface JiraConfigParams {
  baseUrl: string;
  email: string | null;
  apiToken: string; // decrypted
  jiraType: 'cloud' | 'server';
  boardId: string | null;
}

export class JiraClient {
  private baseUrl: string;
  private authHeaders: Record<string, string>;
  private jiraType: 'cloud' | 'server';

  constructor(params: JiraConfigParams) {
    this.baseUrl = params.baseUrl.replace(/\/$/, '');
    this.jiraType = params.jiraType;

    if (params.jiraType === 'cloud') {
      // Cloud: Basic auth with email:api_token
      const credentials = Buffer.from(`${params.email}:${params.apiToken}`).toString('base64');
      this.authHeaders = { Authorization: `Basic ${credentials}` };
    } else {
      // Server/Data Center: Bearer token or Basic auth with username:password
      // For server, apiToken could be a PAT (Personal Access Token)
      this.authHeaders = { Authorization: `Bearer ${params.apiToken}` };
    }
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.authHeaders,
      ...extra,
    };
  }

  private async request(path: string, options?: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: this.getHeaders(options?.headers as Record<string, string>),
    });

    // Handle rate limiting (429)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.request(path, options);
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => res.statusText);
      throw new Error(`Jira API error ${res.status}: ${errorBody}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // ─── Connection test ────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; serverInfo?: unknown }> {
    try {
      const info = await this.request('/rest/api/2/serverInfo');
      return { ok: true, serverInfo: info };
    } catch (err) {
      return { ok: false };
    }
  }

  // ─── Agile API (boards, sprints) ─────────────────────────

  async getBoards(): Promise<{ id: number; name: string; type: string }[]> {
    const data = await this.request('/rest/agile/1.0/board?maxResults=100') as { values: { id: number; name: string; type: string }[] };
    return data.values ?? [];
  }

  async getSprints(boardId: number): Promise<JiraSprint[]> {
    const data = await this.request(`/rest/agile/1.0/board/${boardId}/sprint?maxResults=100`) as { values: { id: number; name: string; state: string; startDate?: string; endDate?: string; originBoardId?: number }[] };
    return (data.values ?? []).map(s => ({
      id: String(s.id),
      name: s.name,
      state: s.state,
      startDate: s.startDate ?? null,
      endDate: s.endDate ?? null,
      boardId: s.originBoardId ?? null,
    }));
  }

  // ─── Issues ──────────────────────────────────────────────

  async searchEpics(jql: string = 'issuetype = Epic ORDER BY updated DESC'): Promise<JiraIssue[]> {
    const data = await this.request('/rest/api/2/search', {
      method: 'POST',
      body: JSON.stringify({ jql, maxResults: 100, fields: ['summary', 'status', 'customfield_10011', 'assignee'] }),
    }) as { issues: JiraApiIssue[] };
    return data.issues.map(this.mapIssue);
  }

  async getEpicIssues(epicKey: string): Promise<JiraIssue[]> {
    const jql = `'Epic Link' = ${epicKey} ORDER BY rank ASC`;
    const data = await this.request('/rest/api/2/search', {
      method: 'POST',
      body: JSON.stringify({ jql, maxResults: 200, fields: ['summary', 'status', 'customfield_10011', 'assignee', 'sprint'] }),
    }) as { issues: JiraApiIssue[] };
    return data.issues.map(this.mapIssue);
  }

  async getIssue(key: string): Promise<JiraIssue> {
    const data = await this.request(`/rest/api/2/issue/${key}`) as JiraApiIssue;
    return this.mapIssue(data);
  }

  async createIssue(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
    const data = await this.request('/rest/api/2/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }) as { id: string; key: string };
    return data;
  }

  async updateIssue(key: string, fields: Record<string, unknown>): Promise<void> {
    await this.request(`/rest/api/2/issue/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  // ─── Fields ─────────────────────────────────────────────

  async getFields(): Promise<{ id: string; name: string; custom: boolean }[]> {
    const data = await this.request('/rest/api/2/field') as { id: string; name: string; custom: boolean }[];
    return data;
  }

  // ─── Issue mapping ──────────────────────────────────────

  private mapIssue = (issue: JiraApiIssue): JiraIssue => {
    const fields = (issue.fields ?? {}) as Record<string, unknown>;
    const status = (fields.status as { name?: string } | undefined)?.name ?? 'Unknown';
    const storyPoints = (fields.customfield_10011 as number | null | undefined) ?? null;
    const sprintField = fields.sprint as { id: number } | undefined | null;
    const assigneeField = fields.assignee as { displayName?: string } | undefined | null;

    return {
      id: issue.id,
      key: issue.key,
      summary: (fields.summary as string) ?? '',
      status,
      storyPoints,
      sprintId: sprintField?.id != null ? String(sprintField.id) : null,
      assignee: assigneeField?.displayName ?? null,
    };
  }
}

// Internal type for the raw Jira API response
interface JiraApiIssue {
  id: string;
  key: string;
  fields: Record<string, unknown> | null;
}