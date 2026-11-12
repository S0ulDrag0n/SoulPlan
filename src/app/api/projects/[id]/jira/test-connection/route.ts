import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { JiraClient } from '@/lib/jira/client';

// POST /api/projects/[id]/jira/test-connection — test Jira connection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json();
    const client = new JiraClient({
      baseUrl: body.baseUrl,
      email: body.email ?? null,
      apiToken: body.apiToken ?? '',
      jiraType: body.jiraType ?? 'cloud',
      boardId: null,
    });
    const result = await client.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST jira/test-connection error:', error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}