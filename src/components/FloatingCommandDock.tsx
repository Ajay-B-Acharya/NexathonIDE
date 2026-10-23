import React from 'react';
import { Terminal, Sparkles, Plus, Share2, SunMoon, Check, Laptop } from 'lucide-react';
import { ThemeMode } from './ThemeToggle';

interface FloatingCommandDockProps {
  theme?: ThemeMode;
  onNewWorkspace?: () => void;
  onLaunchWasmLab?: () => void;
  onOpenTerminal?: () => void;
  onOpenAIDiff?: () => void;
  onToggleTheme?: (nextTheme: ThemeMode) => void;
  isEmbedded?: boolean;
}

export const FloatingCommandDock: React.FC<FloatingCommandDockProps> = ({
  theme = 'dark',
  onNewWorkspace = () => {},
  onLaunchWasmLab,
  onOpenTerminal,
  onOpenAIDiff,
  onToggleTheme = () => {},
  isEmbedded = false,
}) => {
  const [copiedLink, setCopiedLink] = React.useState(false);

  const handleCopyMesh = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isDark = theme === 'dark';

  const dockItems = [
    {
      icon: Plus,
      label: 'New Custom Workspace',
      action: onNewWorkspace,
      accent: 'text-indigo-500 dark:text-indigo-400',
      tag: '⌘N',
    },
    {
      icon: Laptop,
      label: '1-Click Pyodide WASM Lab',
      action: onLaunchWasmLab || onNewWorkspace,
      accent: 'text-emerald-500 dark:text-emerald-400',
      tag: '0ms Boot',
    },
    {
      icon: Terminal,
      label: 'Node-PTY Linux Terminal',
      action: onOpenTerminal || onNewWorkspace,
      accent: 'text-sky-500 dark:text-sky-400',
      tag: 'WS:3001',
    },
    {
      icon: Sparkles,
      label: 'AI Diff Diagnostics',
      action: onOpenAIDiff || onNewWorkspace,
      accent: 'text-purple-500 dark:text-purple-400',
      tag: 'AST Doctor',
    },
    {
      icon: copiedLink ? Check : Share2,
      label: copiedLink ? 'Mesh Link Copied!' : 'Copy Mesh Invite Link',
      action: handleCopyMesh,
      accent: copiedLink ? 'text-emerald-500' : 'text-amber-500 dark:text-amber-400',
      tag: 'Yjs',
    },
    {
      icon: SunMoon,
      label: isDark ? 'Switch to Titanium Day' : 'Switch to Obsidian Night',
      action: () => onToggleTheme(isDark ? 'light' : 'dark'),
      accent: isDark ? 'text-amber-400' : 'text-indigo-600',
      tag: isDark ? 'Light' : 'Dark',
    },
  ];

  const wrapperClass = isEmbedded
    ? 'w-full flex justify-center py-2 select-none relative z-30'
    : 'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl border theme-border theme-bg-glass backdrop-blur-2xl theme-shadow shadow-2xl">
        {dockItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={item.action}
              className="group relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl theme-bg-surface-2 border theme-border hover:border-indigo-500/50 hover:theme-bg-surface-1 transition-all duration-200 hover:-translate-y-2 hover:scale-115 active:scale-95 cursor-pointer shadow-xs"
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${item.accent}`} />

              {/* Floating Tooltip with hotkey/tag - elevated z-50 with shadow */}
              <span className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 px-2.5 py-1 rounded-lg theme-bg-surface-1 border theme-border theme-text-primary font-mono text-[10px] whitespace-nowrap shadow-xl flex items-center gap-1.5 z-50">
                <span className="font-semibold">{item.label}</span>
                <span className="text-indigo-500 dark:text-indigo-400 font-bold opacity-90">{item.tag}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingCommandDock;
