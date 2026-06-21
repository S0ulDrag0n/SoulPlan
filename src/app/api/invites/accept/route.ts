import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

// POST /api/invites/accept — accept a project invite
// Body: { token: string, name: string }
// Returns: { guest, session, project, invite }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const result = await q.acceptInvite(token, name.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept invite';
    const status = message.includes('Invalid') || message.includes('not found') ? 404 : 500;
    console.error('POST /api/invites/accept error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/invites/accept?token=<token> — preview invite info (no auth needed)
// Returns: { projectName, role } so the join page can show what they're joining
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const invite = await q.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }

    const project = await q.getProject(invite.projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      projectName: project.name,
      role: invite.role,
      projectId: invite.projectId,
    });
  } catch (error) {
    console.error('GET /api/invites/accept error:', error);
    return NextResponse.json({ error: 'Failed to verify invite' }, { status: 500 });
  }
}