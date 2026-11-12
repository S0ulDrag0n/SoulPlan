import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { JiraClient } from '@/lib/jira/client';
import { getDb } from '@/lib/db/sqlite';
import { decryptToken } from '@/lib/jira/crypto';

// GET /api/projects/[id]/jira/boards — list Jira boards
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const db = await getDb();
    const configRow = await db.getJiraConfig(id);
    if (!configRow) return NextResponse.json({ error: 'Jira not configured' }, { status: 400 });

    const apiToken = configRow.encrypted_token ? decryptToken(configRow.encrypted_token) : (configRow.api_token ?? '');
    const client = new JiraClient({
      baseUrl: configRow.base_url,
      email: configRow.email,
      apiToken,
      jiraType: configRow.jira_type as 'cloud' | 'server',
      boardId: configRow.board_id,
    });

    const boards = await client.getBoards();
    return NextResponse.json(boards);
  } catch (error) {
    console.error('GET jira/boards error:', error);
    return NextResponse.json({ error: 'Failed to get boards' }, { status: 500 });
  }
}