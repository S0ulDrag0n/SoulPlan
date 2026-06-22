import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole } from '@/lib/auth';

// GET /api/projects/[id]/jira/config — get Jira config for project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (!role) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const config = await q.getJiraConfig(id);
    return NextResponse.json(config || { configured: false });
  } catch (error) {
    console.error('GET jira/config error:', error);
    return NextResponse.json({ error: 'Failed to get Jira config' }, { status: 500 });
  }
}

// POST /api/projects/[id]/jira/config — create Jira config (owner only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

    const body = await req.json();
    if (!body.baseUrl) return NextResponse.json({ error: 'baseUrl required' }, { status: 400 });

    const config = await q.createJiraConfig(
      id, body.baseUrl, body.jiraType ?? 'cloud',
      body.email ?? null, body.apiToken ?? null, body.boardId ?? null
    );
    return NextResponse.json(config);
  } catch (error) {
    console.error('POST jira/config error:', error);
    return NextResponse.json({ error: 'Failed to create Jira config' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/jira/config — update Jira config (owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

    const body = await req.json();
    const config = await q.getJiraConfig(id);
    if (!config) return NextResponse.json({ error: 'No config to update' }, { status: 404 });
    await q.updateJiraConfigById(config.id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH jira/config error:', error);
    return NextResponse.json({ error: 'Failed to update Jira config' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/jira/config — delete Jira config (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth(req);
    const role = await getMemberRole(id, session.memberId);
    if (role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

    const config = await q.getJiraConfig(id);
    if (config) await q.deleteJiraConfig(config.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE jira/config error:', error);
    return NextResponse.json({ error: 'Failed to delete Jira config' }, { status: 500 });
  }
}