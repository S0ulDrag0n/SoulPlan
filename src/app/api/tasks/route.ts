import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/types';

// POST /api/tasks — create a task
export async function POST(req: NextRequest) {
  try {
    const body: CreateTaskInput = await req.json();
    if (!body.sprintId || !body.title) {
      return NextResponse.json({ error: 'sprintId and title required' }, { status: 400 });
    }
    const task = await q.createTask(body);
    return NextResponse.json(task);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH /api/tasks — update a task (move between sprints, edit fields)
export async function PATCH(req: NextRequest) {
  try {
    const body: UpdateTaskInput = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await q.updateTask(body);
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
    await q.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}