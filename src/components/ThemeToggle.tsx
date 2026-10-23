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
      className="group relative inline-flex items-center gap-2 rounded-full border theme-border theme-bg-surface-2 px-3 py-1 text-xs font-medium theme-text-secondary hover:border-teal-500/40 hover:theme-text-primary transition cursor-pointer shadow-xs"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-teal-400 transition-transform duration-200 group-hover:-rotate-12" />
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

