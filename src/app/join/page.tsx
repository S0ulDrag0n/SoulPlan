'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import * as api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

function JoinPageContent() {
  const { session, setSessionDirect } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [preview, setPreview] = useState<{ projectName: string; role: string; projectId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Preview invite info — fires once when we have a token
  const loadPreview = useCallback(async (t: string) => {
    try {
      const info = await api.previewInvite(t);
      setPreview(info);
    } catch (err) {
      // Surface the actual API error rather than a generic message
      const msg = err instanceof Error ? err.message : 'Failed to load invite';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Missing invite token. Check your share link.');
      setLoading(false);
      return;
    }
    loadPreview(token);
  }, [token, loadPreview]);

  const handleAccept = async () => {
    if (!token || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.acceptInvite(token, name.trim());
      // Store the session
      localStorage.setItem('soulplan-session-token', result.session.token);
      localStorage.setItem('soulplan-session-info', JSON.stringify(result.session));
      // Land on the project they just joined, not a blank board
      localStorage.setItem('soulplan-selected-project', result.project.id);
      // Update React state directly so AuthProvider knows about the session
      // immediately — without this, useRealtime sees session=null and never
      // connects SSE until a manual page refresh.
      setSessionDirect(result.session);
      // Redirect to the main app
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join project');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-400">Loading invite...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">SoulPlan</h1>

        {error ? (
          <>
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Go to SoulPlan
            </button>
          </>
        ) : preview ? (
          <>
            <p className="text-gray-500 dark:text-gray-400 mb-1">You&apos;ve been invited to join</p>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">{preview.projectName}</h2>
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You&apos;ll join as <strong>{preview.role}</strong> with a guest account.
              </p>
            </div>

            {session && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                You&apos;re already logged in as <strong>{session.displayName}</strong>. Accepting will create a new guest account for this project.
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAccept(); }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
              placeholder="Enter your name"
              autoFocus
            />

            <button
              onClick={handleAccept}
              disabled={busy || !name.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 mb-3"
            >
              {busy ? 'Joining...' : 'Join Project'}
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Already have an account? Go to SoulPlan
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}