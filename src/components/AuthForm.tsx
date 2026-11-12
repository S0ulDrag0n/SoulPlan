'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';

export default function AuthForm() {
  const { login, register, joinAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { if (mode === 'register') { await register(username, password); } else { await login(username, password); } }
    catch (err: any) { setError(err.message || 'Authentication failed'); }
    finally { setLoading(false); }
  };

  const handleGuest = async () => {
    setLoading(true); setError(null);
    try { await joinAsGuest('Guest'); }
    catch (err: any) { setError(err.message || 'Failed to create guest session'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">SoulPlan</h1>
          <p className="text-white/70 text-sm mt-1">Visual Sprint Planning</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
            <button onClick={() => setMode('login')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'login' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Sign In</button>
            <button onClick={() => setMode('register')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'register' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Register</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500" placeholder="Enter username" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500" placeholder="Enter password" required />
            </div>
            {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50">{loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={handleGuest} disabled={loading} className="w-full py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Continue as Guest</button>
          </div>
        </div>
      </div>
    </div>
  );
}
