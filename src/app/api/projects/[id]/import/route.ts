import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { requireUser, getMemberRole, AuthError } from '@/lib/auth';
import { broadcastBoardUpdate } from '@/lib/realtime/broadcast';
import type { ProjectImportPayload } from '@/lib/types';

// POST /api/projects/[id]/import — create a NEW project from an exported snapshot.
//
// Body: ProjectImportPayload = { schemaVersion: 1, project: { name }, boards: BoardState[] }
//
// The [id] path param identifies the SOURCE project the user is importing
// FROM (used only for the owner-permission check). The imported data is
// written into a brand-new project with a fresh UUID, owned by the
// authenticated user. All child entity IDs are remapped so the imported
// tree is internally consistent and never collides with existing rows.
//
// Access: any project OWNER can import (creating a new project requires a
// user account, and we gate on owner-of-source to prevent a viewer/editor
// from exfiltrating a project they shouldn't be able to clone).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser(req);
    const { id: sourceProjectId } = await params;

    // Only owners of the source project can import (clone) it.
    const role = await getMemberRole(sourceProjectId, session.memberId);
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only project owners can import (clone) a project' },
        { status: 403 }
      );
    }

    const body = await req.json() as ProjectImportPayload;
    if (body.schemaVersion !== 1) {
      return NextResponse.json(
        { error: `Unsupported schemaVersion: ${body.schemaVersion}` },
        { status: 400 }
      );
    }
    if (!body.project || typeof body.project.name !== 'string' || !body.project.name.trim()) {
      return NextResponse.json({ error: 'project.name is required' }, { status: 400 });
    }
    if (!Array.isArray(body.boards)) {
      return NextResponse.json({ error: 'boards must be an array' }, { status: 400 });
    }

    const result = await q.importProject(body, session.memberId);

    // Broadcast a board-update for the NEW project so any client already
    // viewing it (unlikely mid-create, but cheap and correct) reloads.
    broadcastBoardUpdate(result.project.id, 'project-imported');

    return NextResponse.json(result.project, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/projects/[id]/import error:', error);
    return NextResponse.json({ error: 'Failed to import project' }, { status: 500 });
  }
}