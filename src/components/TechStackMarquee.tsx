import React from 'react';

const TECH_ITEMS = [
  { name: 'Python 3.12', badge: 'Scientific Stack' },
  { name: 'Pyodide WASM v0.26', badge: '0ms Cold Start' },
  { name: 'QuickJS Engine', badge: 'Isolated Worker' },
  { name: 'Node-PTY POSIX Shell', badge: 'Full-Duplex' },
  { name: 'Yjs State Vectors', badge: 'Conflict-Free' },
  { name: 'Monaco Editor', badge: 'VS Code Engine' },
  { name: '@xterm/xterm', badge: 'WebGL Terminal' },
  { name: 'PostgreSQL 16', badge: 'Workspace Snapshots' },
  { name: 'OpenAI GPT-4o', badge: 'AI Diff Guard' },
  { name: 'Supabase Pooler', badge: 'Row-Level Auth' },
  { name: 'WebRTC Peer Mesh', badge: 'Direct Transport' },
  { name: 'Web Workers', badge: 'Non-Blocking' },
];

export const TechStackMarquee: React.FC = () => {
  return (
    <div className="relative w-full overflow-hidden border-y theme-border theme-bg-surface-1/40 py-4 my-8 select-none">
      {/* Edge gradient masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-(--bg-root) to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-(--bg-root) to-transparent" />

      <div className="flex w-max animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused] gap-4">
        {[...TECH_ITEMS, ...TECH_ITEMS].map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-xl border theme-border theme-bg-surface-2 px-3.5 py-1.5 text-xs font-mono theme-text-primary neu-card transition-colors hover:border-[#FF7057]/40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF7057]" />
            <span className="font-semibold">{item.name}</span>
            <span className="rounded bg-[#FF7057]/10 border border-[#FF7057]/20 px-1.5 py-0.2 text-[10px] text-[#FF7057]">
              {item.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechStackMarquee;

