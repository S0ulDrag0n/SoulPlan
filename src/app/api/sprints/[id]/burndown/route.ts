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
  tasks: { id: string; title: string; estimate: number; isCritical: boolean; createdAt: string }[];
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

    // Verify project membership via release → board → project chain
    const releases = await db.getReleasesByBoardId('');
    // Find the release that contains this sprint
    const releaseRows = await db.getSprintsByReleaseIds([sprintRow.release_id]);
    if (!releaseRows.find(s => s.id === id)) {
      return NextResponse.json({ error: 'Sprint not found in release' }, { status: 404 });
    }

    const taskRows = await db.getTasksBySprintIds([id]);
    const tasks = taskRows.map(toTask);

    const totalPoints = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
    const completedPoints = tasks.filter(t => t.isCritical).reduce((sum, t) => sum + (t.estimate || 0), 0);
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
          .filter(t => new Date(t.createdAt) <= date)
          .filter(t => t.isCritical)
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
      tasks: tasks.map(t => ({ id: t.id, title: t.title, estimate: t.estimate, isCritical: t.isCritical, createdAt: t.createdAt })),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/sprints/[id]/burndown error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}