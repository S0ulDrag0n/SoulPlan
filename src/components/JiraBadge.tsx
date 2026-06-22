'use client';

interface Props {
  issueKey: string | null | undefined;
  status?: string | null | undefined;
}

export function JiraBadge({ issueKey, status }: Props) {
  if (!issueKey) return null;

  const statusColor = (s: string | null | undefined): string => {
    if (!s) return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    const lower = s.toLowerCase();
    if (lower.includes('done') || lower.includes('closed')) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    if (lower.includes('progress') || lower.includes('in progress')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    if (lower.includes('todo') || lower.includes('open') || lower.includes('backlog')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
        {issueKey}
      </span>
      {status && (
        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${statusColor(status)}`}>
          {status}
        </span>
      )}
    </div>
  );
}