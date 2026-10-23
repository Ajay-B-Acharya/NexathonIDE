import React from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'dark' | 'light';

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: (nextTheme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => onToggle(isDark ? 'light' : 'dark')}
      title={`Switch to ${isDark ? 'Titanium Light' : 'Obsidian Dark'} Theme`}
      aria-label={`Switch to ${isDark ? 'Titanium Light' : 'Obsidian Dark'} Theme`}
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer ${
        isDark
          ? 'border-white/10 bg-[#141824] text-slate-300 hover:border-indigo-500/40 hover:text-white shadow-[0_0_12px_rgba(99,102,241,0.12)]'
          : 'border-slate-300/80 bg-white text-slate-700 hover:border-indigo-500/40 hover:text-slate-950 shadow-xs'
      }`}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-indigo-400 transition-transform duration-200 group-hover:-rotate-12" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500 transition-transform duration-200 group-hover:rotate-45" />
        )}
      </span>
      <span className="hidden sm:inline font-mono text-[11px]">
        {isDark ? 'Obsidian' : 'Titanium'}
      </span>
    </button>
  );
};

