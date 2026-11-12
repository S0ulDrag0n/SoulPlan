/**
 * Pure burndown computation.
 *
 * Day buckets are compared as DATE STRINGS ('YYYY-MM-DD'). completedAt is
 * stored as a server-local 'YYYY-MM-DD HH:MM:SS' string: bucketing through
 * new Date() would shift evening completions onto the next UTC day, which is
 * why the math never leaves the date-string domain.
 */

export interface BurndownTask {
  id: string;
  title: string;
  estimate: number;
  status: string;
  isCritical: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface BurndownPoint {
  day: number;
  date: string;
  remaining: number;
}

export interface SprintBounds {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface BurndownResult {
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  sprint: SprintBounds;
  idealLine: BurndownPoint[];
  actualLine: BurndownPoint[];
}

/** First 10 chars of a 'YYYY-MM-DD...' string: '' when absent/malformed. */
export function datePart(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : '';
}

/** Date-string for `start` + `days` days, in the UTC-day domain. */
export function plusDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
}

export function computeBurndown(
  tasks: BurndownTask[],
  sprint: SprintBounds,
  today: string,
): BurndownResult {
  const totalPoints = tasks.reduce((sum, t) => sum + (t.estimate || 0), 0);
  const completedPoints = tasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + (t.estimate || 0), 0);
  const remainingPoints = totalPoints - completedPoints;

  const result: BurndownResult = {
    totalPoints,
    completedPoints,
    remainingPoints,
    sprint: { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate },
    idealLine: [],
    actualLine: [],
  };

  const start = datePart(sprint.startDate);
  const end = datePart(sprint.endDate);
  if (!start || !end) return result;

  const days = Math.max(
    1,
    Math.round((Date.UTC(+end.slice(0,4), +end.slice(5,7) - 1, +end.slice(8,10)) -
                Date.UTC(+start.slice(0,4), +start.slice(5,7) - 1, +start.slice(8,10))) / 86_400_000),
  );

  // Ideal line spans the full sprint, including days in the future.
  for (let day = 0; day <= days; day++) {
    result.idealLine.push({
      day,
      date: plusDays(start, day),
      remaining: Math.round(totalPoints * (1 - day / days)),
    });
  }

  // Actual line stops at today: the future has no observed state.
  for (let day = 0; day <= days; day++) {
    const marker = plusDays(start, day);
    if (marker > today) break;
    const completedByDay = tasks
      .filter((t) => t.completedAt && datePart(t.completedAt) <= marker && datePart(t.completedAt) !== '')
      .reduce((sum, t) => sum + (t.estimate || 0), 0);
    result.actualLine.push({
      day,
      date: marker,
      remaining: totalPoints - completedByDay,
    });
  }

  return result;
}
