'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResult } from '@/lib/types';
import { searchTasks as apiSearchTasks } from '@/lib/api';

interface SearchBarProps {
  projectId: string;
  /** Called when a result is clicked — parent pans to the task. */
  onJumpToTask: (taskId: string) => void;
}

/**
 * Search bar with Ctrl+K shortcut and debounced results dropdown.
 *
 * - Ctrl+K (or Cmd+K on macOS) focuses the input from anywhere on the page.
 * - Typing triggers a debounced (200ms) search via GET /api/search.
 * - Results show task name + sprint/release context; clicking jumps to the task.
 * - ESC clears the query and blurs; clicking outside closes the dropdown.
 */
export default function SearchBar({ projectId, onJumpToTask }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  // Global Ctrl+K / Cmd+K shortcut to focus the search input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounced search — 200ms after the last keystroke.
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const myReqId = ++requestIdRef.current;
      try {
        const data = await apiSearchTasks(projectId, trimmed);
        // Ignore stale responses from a previous query.
        if (requestIdRef.current !== myReqId) return;
        setResults(data.results);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        if (requestIdRef.current === myReqId) setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  // Close dropdown when clicking outside the search container.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    onJumpToTask(result.id);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }, [onJumpToTask]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setResults([]);
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  }, [results, activeIndex, handleSelect]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks…  (Ctrl+K)"
          className="w-56 pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
        />
        {loading ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 animate-pulse">
            …
          </span>
        ) : null}
      </div>

      {isOpen && (results.length > 0 || !loading) ? (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50 min-w-[280px]">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
              No matching tasks
            </div>
          ) : (
            <ul className="py-1">
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-start gap-2 ${
                      activeIndex === index
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span
                      className="mt-1 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: result.color }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-gray-800 dark:text-gray-100 truncate">
                        {result.title}
                      </span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">
                        {result.sprintName} · {result.releaseName}
                      </span>
                    </span>
                    {result.isCritical ? (
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold shrink-0">
                        ⚡
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}