import { computeBurndown, datePart } from '@/lib/burndown';

const sprint = { id: 's1', name: 'Sprint', startDate: '2026-11-09', endDate: '2026-11-13' };

const mkTask = (estimate: number, done: boolean, completedAt: string | null = null) => ({
  id: estimate + (done ? 'd' : 'o'), title: 't', estimate,
  status: done ? 'done' : 'todo', isCritical: false,
  createdAt: '2026-11-09 09:00:00', completedAt,
});

describe('datePart', () => {
  it('takes the leading YYYY-MM-DD from server-local datetime strings', () => {
    expect(datePart('2026-11-12 05:13:28')).toBe('2026-11-12');
    expect(datePart('2026-11-12')).toBe('2026-11-12');
    expect(datePart(null)).toBe('');
  });
});

describe('computeBurndown', () => {
  it('builds a straight ideal line across the sprint', () => {
    const r = computeBurndown([], sprint, '2026-11-09');
    expect(r.idealLine.map(p => p.date)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    ]);
    expect(r.idealLine[r.idealLine.length - 1].remaining).toBe(0);
  });

  it('buckets an EVENING completion on its own day, not the next UTC day', () => {
    // Completed 20:00 server-local on day 0 — new Date() bucketing pushed this
    // onto day 1 for UTC-negative zones; the date-string bucket keeps it on day 0.
    const r = computeBurndown(
      [mkTask(5, true, '2026-11-09 20:00:00')],
      sprint,
      '2026-11-11',
    );
    expect(r.actualLine[0]).toEqual({ day: 0, date: '2026-11-09', remaining: 0 });
    expect(r.actualLine[1]).toEqual({ day: 1, date: '2026-11-10', remaining: 0 });
    expect(r.actualLine).toHaveLength(3); // today cutoff = 2026-11-11 (day 2)
  });

  it('counts nothing before completion and cuts the actual line at today', () => {
    const r = computeBurndown(
      [mkTask(5, true, '2026-11-11 09:00:00')],
      sprint,
      '2026-11-10',
    );
    expect(r.actualLine.map(p => p.remaining)).toEqual([5, 5]);
    expect(r.actualLine[1].date).toBe('2026-11-10');
  });

  it('returns empty lines when the sprint has no date bounds', () => {
    const r = computeBurndown([mkTask(3, false)], { ...sprint, startDate: null, endDate: null }, '2026-11-10');
    expect(r.idealLine).toEqual([]);
    expect(r.actualLine).toEqual([]);
    expect(r.totalPoints).toBe(3);
    expect(r.remainingPoints).toBe(3);
  });
});
