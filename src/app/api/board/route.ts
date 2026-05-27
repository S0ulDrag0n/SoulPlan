import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as q from '@/lib/queries';
import type { Board } from '@/lib/types';

// Ensure DB is initialized on first request
export function GET() {
  getDb(); // init if needed
  try {
    // Return all boards (usually just one for MVP)
    const boards = getDb().prepare('SELECT * FROM boards').all() as Board[];
    if (boards.length === 0) {
      // Auto-create a default board
      const board = q.createBoard('SoulPlan Board');
      const state = q.getFullBoardState(board.id);
      return NextResponse.json(state);
    }
    const state = q.getFullBoardState(boards[0].id);
    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/board error:', error);
    return NextResponse.json({ error: 'Failed to load board' }, { status: 500 });
  }
}