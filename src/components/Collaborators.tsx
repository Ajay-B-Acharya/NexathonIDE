import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { CollaboratorPresence, FollowState } from '../types';

interface CollaboratorsProps {
  collaborators: CollaboratorPresence[];
  currentUserId: string;
  followState?: FollowState | null;
  onFollowCollaborator?: (userId: string, name: string, color: string, activeFile?: string) => void;
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

          const fileName = collab.activeFile ? collab.activeFile.split('/').pop() : '';
          const tooltipText = isMe
            ? `${collab.user.name} (You)`
            : isFollowed
            ? `Following ${collab.user.name} • Click to Stop Following`
            : `${collab.user.name}${fileName ? ` • ${fileName}` : ''} • Click to Follow (Ln ${collab.cursor?.lineNumber || 1})`;

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
                    collab.user.color,
                    collab.activeFile
                  );
                }
              }}
              className={`group relative flex items-center transition-transform duration-150 ${
                isMe ? 'cursor-default' : 'cursor-pointer hover:z-20 hover:scale-115'
              }`}
              title={tooltipText}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white transition-all ring-2 ring-(--bg-root) ${
                  isFollowed ? 'ring-2 ring-cyan-400 animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: collab.user.color,
                  boxShadow: isFollowed
                    ? `0 0 12px ${collab.user.color}`
                    : `0 0 0 1px var(--border-hairline), 0 0 6px ${collab.user.color}40`,
                }}
              >
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-(--bg-root)">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isFollowed ? 'bg-cyan-400 animate-ping' : 'bg-emerald-500'
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
          const fileName = collab.activeFile ? collab.activeFile.split('/').pop() : '';

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
                    collab.user.color,
                    collab.activeFile
                  );
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                isFollowed
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                  : 'theme-border theme-bg-surface-2 theme-text-secondary hover:border-cyan-500/30'
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
              <span className="max-w-[70px] truncate font-medium theme-text-primary">
                {collab.user.name}
              </span>
              {fileName && (
                <span className="rounded bg-indigo-500/10 border border-indigo-500/30 px-1 py-0.2 text-[9.5px] font-mono text-indigo-400 max-w-[65px] truncate">
                  {fileName}
                </span>
              )}
              {collab.cursor && (
                <span className="rounded theme-bg-surface-1 border theme-border px-1 py-0.2 text-[10px] font-mono theme-text-secondary">
                  Ln {collab.cursor.lineNumber}
                </span>
              )}
              {!isMe && (
                isFollowed ? (
                  <EyeOff className="h-3 w-3 text-cyan-400" />
                ) : (
                  <Eye className="h-3 w-3 theme-text-secondary opacity-60 group-hover:opacity-100" />
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
