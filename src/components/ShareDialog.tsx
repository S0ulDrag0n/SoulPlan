'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProjectInvite, ProjectMember } from '@/lib/types';
import * as api from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface ShareDialogProps {
  projectId: string;
  onClose: () => void;
  onAcceptedInvite?: (projectId: string) => void;
}

export default function ShareDialog({ projectId, onClose, onAcceptedInvite }: ShareDialogProps) {
  const { session } = useAuth();
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, mem] = await Promise.all([
        api.fetchProjectInvites(projectId),
        api.fetchProjectMembers(projectId),
      ]);
      setInvites(inv);
      setMembers(mem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share info');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const invite = await api.createProjectInvite(projectId);
      setInvites((prev) => [...prev, invite]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await api.revokeProjectInvite(projectId, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link');
    }
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/join?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Fallback: select the link for manual copy
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  const handleRemoveMember = async (memberRowId: string) => {
    try {
      await api.removeProjectMember(projectId, memberRowId);
      setMembers((prev) => prev.filter((m) => m.id !== memberRowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Share Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Share links section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Share Links</h3>
              <button
                onClick={handleCreateInvite}
                disabled={creating}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : '+ New Link'}
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-gray-400 py-2">Loading...</div>
            ) : invites.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 py-2">
                No share links yet. Create one to invite collaborators.
              </div>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => {
                  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?token=${invite.token}`;
                  const isCopied = copiedToken === invite.token;
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Role: <span className="font-medium">{invite.role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 font-mono">
                            {link}
                          </code>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopyLink(invite.token)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                          isCopied
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        {isCopied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        title="Revoke link"
                      >
                        Revoke
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Members</h3>
            {loading ? (
              <div className="text-sm text-gray-400 py-2">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 py-2">No members yet</div>
            ) : (
              <div className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        member.memberType === 'user'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {member.memberType === 'user' ? '👤' : '👋'}
                      </div>
                      <div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {member.memberId === session?.memberId ? 'You' : `Member ${member.memberId.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {member.memberType} · {member.role}
                        </div>
                      </div>
                    </div>
                    {member.role !== 'owner' && member.memberId !== session?.memberId && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-xs text-red-500 dark:text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}