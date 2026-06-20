'use client';

import type { PresenceMember } from '@/hooks/useRealtime';

interface PresenceBarProps {
  presence: PresenceMember[];
  selfMemberId: string | null;
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-teal-500',
];

function colorClassForMember(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) {
    hash = ((hash << 5) - hash) + memberId.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PresenceBar({ presence, selfMemberId }: PresenceBarProps) {
  if (presence.length === 0) return null;

  // Show self first, then others
  const sorted = [...presence].sort((a, b) => {
    if (a.memberId === selfMemberId) return -1;
    if (b.memberId === selfMemberId) return 1;
    return 0;
  });

  // Show max 5 avatars, then "+N" indicator
  const visible = sorted.slice(0, 5);
  const overflow = sorted.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {visible.map((member) => {
          const isSelf = member.memberId === selfMemberId;
          const colorClass = colorClassForMember(member.memberId);
          return (
            <div
              key={member.memberId}
              className={`w-8 h-8 rounded-full ${colorClass} ring-2 ring-white dark:ring-gray-800 flex items-center justify-center text-xs font-bold text-white`}
              title={`${member.memberName}${isSelf ? ' (you)' : ''}`}
            >
              {initials(member.memberName)}
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          +{overflow}
        </span>
      )}
      {/* Online indicator dot */}
      <div className="flex items-center gap-1 ml-1">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {presence.length} online
        </span>
      </div>
    </div>
  );
}