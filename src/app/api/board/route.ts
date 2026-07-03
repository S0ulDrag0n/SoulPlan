import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { authenticate, getMemberRole, AuthError } from '@/lib/auth';

// GET /api/board — load board state for a project.
//   ?projectId=X: loads the first board for the project (creates one if none exists)
//   ?boardId=X:   loads a specific board by ID (returns 404 if not found)
export async function GET(req: NextRequest) {
  try {
    const session = await authenticate(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');
    const projectId = searchParams.get('projectId');

    if (projectId) {
      // Verify the user is a member of this project
      const role = await getMemberRole(projectId, session.memberId);
      if (role === null) {
        return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
      }

      const states = await q.getBoardsByProjectId(projectId);
      if (states.length === 0) {
        // No boards for this project yet — create a default one
        const state = await q.createDefaultBoardForProject(projectId);
        return NextResponse.json(state);
      }
      return NextResponse.json(states[0]);
    }

    if (boardId) {
      const state = await q.getFullBoardState(boardId);
      if (!state) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
      }
      return NextResponse.json(state);
    }

    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/board error:', error);
    return NextResponse.json({ error: 'Failed to load board' }, { status: 500 });
  }
}