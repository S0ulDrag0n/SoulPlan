import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { requireAuth, getMemberRole } from '@/lib/auth';
import { toSprint, toTask } from '@/lib/transform';

interface BurndownData {
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  sprint: { id: string; name: string; startDate: string | null; endDate: string | null };
  idealLine: { day: number; date: string; remaining: number }[];
  actualLine: { day: number; date: string; remaining: number }[];
  tasks: { id: string; title: string; estimate: number; status: string; isCritical: boolean; createdAt: string; completedAt: string | null }[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getDb();

    const sprintRow = await db.getSprint(id);
    if (!sprintRow) return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    const sprint = toSprint(sprintRow);

    // Verify project membership via release → board → project chain.
    const releaseRow = await db.getRelease(sprintRow.release_id);
    if (!releaseRow) return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    const boardRow = await db.getBoard(releaseRow.board_id);
    if (!boardRow || !boardRow.project_id) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }
    const role = await getMemberRole(boardRow.project_id, session.memberId);
    if (role === null) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const taskRows = await db.getTasksBySprintIds([id]);
    const tasks = taskRows.map(toTask);

    const totalPoints = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
    const completedPoints = tasks
      .filter(t => t.status === 'done')
      .reduce((sum, t) => sum + (t.estimate || 0), 0);
    const remainingPoints = totalPoints - completedPoints;

    let idealLine: { day: number; date: string; remaining: number }[] = [];
    let actualLine: { day: number; date: string; remaining: number }[] = [];

    if (sprint.startDate && sprint.endDate) {
      const start = new Date(sprint.startDate);
      const end = new Date(sprint.endDate);
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      for (let d = 0; d <= days; d++) {
        const date = new Date(start.getTime() + d * 24 * 60 * 60 * 1000);
        const remaining = Math.round(totalPoints * (1 - d / days));
        idealLine.push({ day: d, date: date.toISOString().split('T')[0], remaining });
      }

      const now = new Date();
      for (let d = 0; d <= days; d++) {
        const date = new Date(start.getTime() + d * 24 * 60 * 60 * 1000);
        if (date > now) break;
        const completedByDay = tasks
          .filter(t => t.completedAt && new Date(t.completedAt) <= date)
          .reduce((sum, t) => sum + (t.estimate || 0), 0);
        actualLine.push({
          day: d,
          date: date.toISOString().split('T')[0],
          remaining: totalPoints - completedByDay,
        });
      }
    }

    const data: BurndownData = {
      totalPoints,
      completedPoints,
      remainingPoints,
      sprint: { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate },
      idealLine,
      actualLine,
      tasks: tasks.map(t => ({
        id: t.id, title: t.title, estimate: t.estimate, status: t.status,
        isCritical: t.isCritical, createdAt: t.createdAt, completedAt: t.completedAt,
      })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/sprints/[id]/burndown error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}