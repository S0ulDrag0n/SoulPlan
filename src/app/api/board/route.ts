import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';

// GET /api/board — load board state
//   No params:  loads the first board (default behavior for backward compat)
//   ?boardId=X: loads a specific board
//   ?projectId=X: loads all boards for a project (returns array)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');
    const projectId = searchParams.get('projectId');

    if (projectId) {
      const states = await q.getBoardsByProjectId(projectId);
      return NextResponse.json(states);
    }

    if (boardId) {
      const state = await q.getFullBoardState(boardId);
      if (!state) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
      }
      return NextResponse.json(state);
    }

    const state = await q.getOrCreateDefaultBoard();
    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/board error:', error);
    return NextResponse.json({ error: 'Failed to load board' }, { status: 500 });
  }
}