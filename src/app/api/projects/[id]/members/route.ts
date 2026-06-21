import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, AuthError } from '@/lib/auth';

// GET /api/projects/[id]/members — list members of a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const members = await q.getProjectMembers(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error('GET /api/projects/[id]/members error:', error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

// POST /api/projects/[id]/members — add a member to the project
// Body: { memberType: 'user' | 'guest', memberId: string, role?: 'owner' | 'editor' | 'viewer' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: projectId } = await params;
    const body = await req.json();
    const { memberType, memberId, role } = body;

    if (!memberType || !memberId) {
      return NextResponse.json({ error: 'memberType and memberId required' }, { status: 400 });
    }
    if (!['user', 'guest'].includes(memberType)) {
      return NextResponse.json({ error: 'memberType must be user or guest' }, { status: 400 });
    }

    // Only project owners or editors can add members.
    const requesterRole = await import('@/lib/auth').then(m => m.getMemberRole(projectId, session.memberId));
    if (requesterRole !== 'owner' && requesterRole !== 'editor') {
      return NextResponse.json({ error: 'Only project members can add other members' }, { status: 403 });
    }

    const member = await q.addProjectMember(projectId, memberType, memberId, role ?? 'editor');
    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/projects/[id]/members error:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}