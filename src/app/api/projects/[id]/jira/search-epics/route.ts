import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { JiraClient } from '@/lib/jira/client';
import { getDb } from '@/lib/db/sqlite';
import { decryptToken } from '@/lib/jira/crypto';

async function getClientForProject(projectId: string): Promise<JiraClient> {
  const db = await getDb();
  const configRow = await db.getJiraConfig(projectId);
  if (!configRow) throw new Error('Jira not configured');
  const apiToken = configRow.encrypted_token ? decryptToken(configRow.encrypted_token) : (configRow.api_token ?? '');
  return new JiraClient({
    baseUrl: configRow.base_url,
    email: configRow.email,
    apiToken,
    jiraType: configRow.jira_type as 'cloud' | 'server',
    boardId: configRow.board_id,
  });
}

// GET /api/projects/[id]/jira/search-epics — search Jira epics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const client = await getClientForProject(id);
    const epics = await client.searchEpics();
    return NextResponse.json(epics);
  } catch (error) {
    console.error('GET jira/search-epics error:', error);
    return NextResponse.json({ error: 'Failed to search epics' }, { status: 500 });
  }
}