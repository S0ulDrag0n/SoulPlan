import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireAuth, AuthError } from '@/lib/auth';

// DELETE /api/projects/[id]/members/[memberRowId] — remove a member from the project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberRowId: string }> }
) {
  try {
    const session = await requireAuth(req);
    const { id: projectId, memberRowId } = await params;

    // Only project owners can remove members (or members can remove themselves)
    const requesterRole = await import('@/lib/auth').then(m => m.getMemberRole(projectId, session.memberId));
    if (requesterRole !== 'owner') {
      // Allow self-removal
      const members = await q.getProjectMembers(projectId);
      const targetMember = members.find(m => m.id === memberRowId);
      if (!targetMember || targetMember.memberId !== session.memberId) {
        return NextResponse.json({ error: 'Only project owners can remove members' }, { status: 403 });
      }
    }

    await q.removeProjectMember(memberRowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/projects/[id]/members/[memberRowId] error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}