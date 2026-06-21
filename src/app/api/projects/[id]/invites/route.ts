import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, getMemberRole, AuthError } from '@/lib/auth';

// GET /api/projects/[id]/invites — list invites for a project (members only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: projectId } = await params;

    // Any project member can view invites
    const role = await getMemberRole(projectId, session.memberId);
    if (!role) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
    }

    const invites = await q.getInvitesByProjectId(projectId);
    return NextResponse.json(invites);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/projects/[id]/invites error:', error);
    return NextResponse.json({ error: 'Failed to list invites' }, { status: 500 });
  }
}

// POST /api/projects/[id]/invites — create a new share link (owners/editors only)
// Body: { role?: 'editor' | 'viewer' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: projectId } = await params;

    // Only owners can create share links
    const role = await getMemberRole(projectId, session.memberId);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only project owners can create share links' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteRole = body.role === 'viewer' ? 'viewer' : 'editor';

    const invite = await q.createInvite(projectId, inviteRole);
    return NextResponse.json(invite);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/projects/[id]/invites error:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/invites — revoke a share link (owners only)
// Body: { inviteId: string }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: projectId } = await params;

    const role = await getMemberRole(projectId, session.memberId);
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only project owners can revoke share links' }, { status: 403 });
    }

    const body = await req.json();
    const { inviteId } = body;
    if (!inviteId) {
      return NextResponse.json({ error: 'inviteId required' }, { status: 400 });
    }

    await q.deleteInvite(inviteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/projects/[id]/invites error:', error);
    return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
  }
}