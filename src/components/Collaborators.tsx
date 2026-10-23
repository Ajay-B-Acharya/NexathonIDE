import React from 'react';
import { CollaboratorPresence } from '../types';

interface CollaboratorsProps {
  collaborators: CollaboratorPresence[];
  currentUserId: string;
}

export const Collaborators: React.FC<CollaboratorsProps> = ({
  collaborators,
  currentUserId,
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
          const initials = collab.user.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const tooltipText = `${collab.user.name}${isMe ? ' (You)' : ''} • Editing ${
            collab.activeFile || 'workspace'
          }${
            collab.cursor
              ? ` • Ln ${collab.cursor.lineNumber}, Col ${collab.cursor.column}`
              : ''
          }`;

          return (
            <div
              key={`${collab.user.id}-${collab.clientId}`}
              className="group relative flex items-center"
              title={tooltipText}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white transition-transform duration-150 group-hover:z-10 group-hover:scale-110 ring-2 ring-(--bg-root)"
                style={{
                  backgroundColor: collab.user.color,
                  boxShadow: `0 0 0 1px var(--border-hairline), 0 0 6px ${collab.user.color}40`,
                }}
              >
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-(--bg-root)">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            </div>
          );
        })}
      </div>

      {/* Color Legend Pill Bar (visible on very wide 2xl screens to preserve TopBar action space) */}
      <div className="hidden 2xl:flex items-center gap-1.5">
        {uniqueCollaborators.slice(0, 3).map((collab) => (
          <div
            key={collab.clientId}
            className="inline-flex items-center gap-1.5 rounded-full border theme-border theme-bg-surface-2 px-2.5 py-0.5 text-[11px] theme-text-secondary"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: collab.user.color,
                boxShadow: `0 0 6px ${collab.user.color}`,
              }}
            />
            <span className="max-w-[80px] truncate font-medium theme-text-primary">
              {collab.user.name}
            </span>
            {collab.cursor && (
              <span className="rounded theme-bg-surface-1 border theme-border px-1 py-0.2 text-[10px] font-mono theme-text-secondary">
                Ln {collab.cursor.lineNumber}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
