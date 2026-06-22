'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BurndownData } from '@/lib/types';

interface BurndownChartProps {
  sprintId: string;
  sprintName: string;
  onClose: () => void;
}

export default function BurndownChart({ sprintId, sprintName, onClose }: BurndownChartProps) {
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/sprints/${sprintId}/burndown`)
      .then(res => res.json())
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sprintId]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const W = 600;
  const H = 300;
  const PAD = 40;

  const idealLine = data?.idealLine ?? [];
  const actualLine = data?.actualLine ?? [];
  const maxRemaining = data ? Math.max(data.totalPoints, ...idealLine.map(p => p.remaining), 1) : 1;

  const toX = (day: number, maxDay: number) => PAD + (day / Math.max(1, maxDay)) * (W - 2 * PAD);
  const toY = (remaining: number) => H - PAD - (remaining / maxRemaining) * (H - 2 * PAD);

  const maxDay = idealLine.length > 0 ? idealLine[idealLine.length - 1].day : 1;

  const idealPath = idealLine.length > 0
    ? idealLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.day, maxDay)} ${toY(p.remaining)}`).join(' ')
    : '';
  const actualPath = actualLine.length > 0
    ? actualLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.day, maxDay)} ${toY(p.remaining)}`).join(' ')
    : '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">📊 Burndown — {sprintName}</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-lg">✕</button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              Loading chart…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
          ) : data ? (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.totalPoints}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.completedPoints}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.remainingPoints}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                    {data.totalPoints > 0 ? Math.round((data.completedPoints / data.totalPoints) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Done</div>
                </div>
              </div>

              {data.sprint.startDate && data.sprint.endDate ? (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(f => {
                    const y = H - PAD - f * (H - 2 * PAD);
                    return (
                      <g key={f}>
                        <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="1" />
                        <text x={PAD - 8} y={y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-500 text-[10px]">
                          {Math.round(maxRemaining * (1 - f))}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axis labels */}
                  {idealLine.length > 0 && idealLine.map((p, i) => {
                    if (i % Math.ceil(maxDay / 5) !== 0 && i !== maxDay) return null;
                    return (
                      <text key={i} x={toX(p.day, maxDay)} y={H - PAD + 15} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500 text-[10px]">
                        {p.date.slice(5)}
                      </text>
                    );
                  })}

                  {/* Ideal line (dashed) */}
                  <path d={idealPath} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 4" />

                  {/* Actual line (solid) */}
                  {actualPath ? (
                    <path d={actualPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                  ) : null}

                  {/* Legend */}
                  <g transform={`translate(${W - PAD - 140}, ${PAD})`}>
                    <line x1="0" y1="0" x2="20" y2="0" stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 4" />
                    <text x="25" y="4" className="fill-gray-500 dark:fill-gray-400 text-[11px]">Ideal</text>
                    <line x1="60" y1="0" x2="80" y2="0" stroke="#3b82f6" strokeWidth="2.5" />
                    <text x="85" y="4" className="fill-gray-500 dark:fill-gray-400 text-[11px]">Actual</text>
                  </g>
                </svg>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
                  Set sprint start and end dates to see the burndown chart.
                </div>
              )}

              {/* Task list */}
              <details className="mt-3">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                  {data.tasks.length} tasks
                </summary>
                <ul className="mt-2 space-y-1">
                  {data.tasks.map(t => (
                    <li key={t.id} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.isCritical ? '#22c55e' : '#d1d5db' }} />
                      {t.title} — {t.estimate}pt {t.isCritical ? '✓' : ''}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}