import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CollaboratorPresence, FollowState } from '../types';

interface CollaboratorsProps {
  collaborators: CollaboratorPresence[];
  currentUserId: string;
  followState?: FollowState | null;
  onFollowCollaborator?: (userId: string, name: string, color: string) => void;
  onStopFollowing?: () => void;
}

export const Collaborators: React.FC<CollaboratorsProps> = ({
  collaborators,
  currentUserId,
  followState,
  onFollowCollaborator,
  onStopFollowing,
}) => {
  const uniqueCollaborators = React.useMemo(() => {
    const map = new Map<string, CollaboratorPresence>();
    collaborators.forEach((c) => {
      const existing = map.get(c.user.id);
      if (!existing || c.lastActive >= existing.lastActive) {
        map.set(c.user.id, c);
      }
    });
    return Array.from(map.values());
  }, [collaborators]);

  return (
    <div className="flex items-center gap-2.5">
      {/* Overlapping Glowing Avatar Stack */}
      <div className="flex -space-x-2">
        {uniqueCollaborators.map((collab) => {
          const isMe = collab.user.id === currentUserId;
          const isFollowed = followState?.targetUserId === collab.user.id;
          const initials = collab.user.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const tooltipText = isMe
            ? `${collab.user.name} (You)`
            : isFollowed
            ? `Following ${collab.user.name} • Click to Stop Following`
            : `${collab.user.name} • Click to Follow (Ln ${collab.cursor?.lineNumber || 1})`;

          return (
            <button
              type="button"
              key={`${collab.user.id}-${collab.clientId}`}
              disabled={isMe}
              onClick={() => {
                if (isMe) return;
                if (isFollowed) {
                  onStopFollowing?.();
                } else {
                  onFollowCollaborator?.(
                    collab.user.id,
                    collab.user.name,
                    collab.user.color
                  );
                }
              }}
              className={`group relative flex items-center transition-transform duration-150 ${
                isMe ? 'cursor-default' : 'cursor-pointer hover:z-20 hover:scale-115'
              }`}
              title={tooltipText}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white transition-all ${
                  isFollowed ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#090a0f] animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: collab.user.color,
                  boxShadow: isFollowed
                    ? `0 0 12px ${collab.user.color}`
                    : `0 0 0 2px #090a0f, 0 0 0 3.5px ${collab.user.color}`,
                }}
              >
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#090a0f]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isFollowed ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Follow Pill & Legend Bar */}
      <div className="hidden xl:flex items-center gap-1.5">
        {uniqueCollaborators.slice(0, 3).map((collab) => {
          const isMe = collab.user.id === currentUserId;
          const isFollowed = followState?.targetUserId === collab.user.id;

          return (
            <button
              type="button"
              key={collab.clientId}
              disabled={isMe}
              onClick={() => {
                if (isMe) return;
                if (isFollowed) {
                  onStopFollowing?.();
                } else {
                  onFollowCollaborator?.(
                    collab.user.id,
                    collab.user.name,
                    collab.user.color
                  );
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                isFollowed
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                  : 'border-white/10 bg-[#141824] text-slate-300 hover:border-white/20'
              } ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
              title={isMe ? 'You' : isFollowed ? 'Stop Following' : `Follow ${collab.user.name}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: collab.user.color,
                  boxShadow: `0 0 6px ${collab.user.color}`,
                }}
              />
              <span className="max-w-[70px] truncate font-medium text-white">
                {collab.user.name}
              </span>
              {collab.cursor && (
                <span className="rounded bg-black/40 px-1 py-0.2 text-[10px] font-mono text-slate-400">
                  Ln {collab.cursor.lineNumber}
                </span>
              )}
              {!isMe && (
                isFollowed ? (
                  <EyeOff className="h-3 w-3 text-cyan-400" />
                ) : (
                  <Eye className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
