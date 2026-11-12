import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { JiraClient } from '@/lib/jira/client';
import { getDb } from '@/lib/db/sqlite';
import { decryptToken } from '@/lib/jira/crypto';

// GET /api/projects/[id]/jira/epic-issues?epicKey=XXX — get issues in an epic
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const epicKey = req.nextUrl.searchParams.get('epicKey');
    if (!epicKey) return NextResponse.json({ error: 'epicKey required' }, { status: 400 });

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

    const issues = await client.getEpicIssues(epicKey);
    return NextResponse.json(issues);
  } catch (error) {
    console.error('GET jira/epic-issues error:', error);
    return NextResponse.json({ error: 'Failed to get epic issues' }, { status: 500 });
  }
}