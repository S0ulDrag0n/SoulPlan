import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as q from '@/lib/queries';

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  try {
    const { sprintId, title } = await req.json();
    if (!sprintId || !title) {
      return NextResponse.json({ error: 'sprintId and title required' }, { status: 400 });
    }
    const row = getDb().prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks WHERE sprint_id = ?').get(sprintId) as { pos: number };
    const task = q.createTask(sprintId, title, row.pos);
    return NextResponse.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH /api/tasks — update a task (move between sprints, edit, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    q.updateTask(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks — delete a task
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    q.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}