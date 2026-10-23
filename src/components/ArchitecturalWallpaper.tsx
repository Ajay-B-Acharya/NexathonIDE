import React from 'react';
import { ThemeMode } from './ThemeToggle';

interface WallpaperProps {
  theme?: ThemeMode;
}

export const ArchitecturalWallpaper: React.FC<WallpaperProps> = ({ theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-opacity duration-700"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          maskImage: 'radial-gradient(ellipse at 50% 32%, black 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 32%, black 25%, transparent 75%)',
        }}
      >
        <defs>
          {/* 48x48 Architectural Grid with Precision Center Crosshairs */}
          <pattern
            id="nexathon-blueprint-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            {/* Grid line boundary */}
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(15, 23, 42, 0.055)'}
              strokeWidth="1"
            />
            {/* Subtle sub-pixel crosshair (+) at each vertex */}
            <path
              d="M 0 5 L 0 -5 M -5 0 L 5 0"
              stroke={isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(79, 70, 229, 0.35)'}
              strokeWidth="1"
            />
          </pattern>

          {/* Central Atmospheric Focus Glow */}
          <radialGradient id="blueprint-beacon" cx="50%" cy="30%" r="55%">
            <stop
              offset="0%"
              stopColor={isDark ? '#6366f1' : '#4f46e5'}
              stopOpacity={isDark ? '0.22' : '0.14'}
            />
            <stop
              offset="45%"
              stopColor={isDark ? '#a855f7' : '#7c3aed'}
              stopOpacity={isDark ? '0.10' : '0.05'}
            />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base Grid Layer */}
        <rect width="100%" height="100%" fill="url(#nexathon-blueprint-grid)" />

        {/* Focal Spotlight Glow */}
        <rect width="100%" height="100%" fill="url(#blueprint-beacon)" />

        {/* Concentric CRDT Topological Orbit Rings Centered behind the Hero */}
        <g
          stroke={isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(79, 70, 229, 0.12)'}
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        >
          <circle cx="50%" cy="28%" r="160" />
          <circle cx="50%" cy="28%" r="300" />
          <circle cx="50%" cy="28%" r="460" strokeDasharray="3 14" />
          <circle cx="50%" cy="28%" r="640" strokeDasharray="2 20" />
        </g>
      </svg>
    </div>
  );
};

