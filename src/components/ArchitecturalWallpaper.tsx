import React from 'react';
import { ThemeMode } from './ThemeToggle';

interface WallpaperProps {
  theme?: ThemeMode;
}

export const ArchitecturalWallpaper: React.FC<WallpaperProps> = ({ theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-opacity duration-300"
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
          <pattern
            id="nexathon-blueprint-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke={isDark ? '#242424' : '#E9DECE'}
              strokeWidth="1"
            />
            <path
              d="M 0 5 L 0 -5 M -5 0 L 5 0"
              stroke={isDark ? '#333333' : 'rgba(255, 112, 87, 0.4)'}
              strokeWidth="1"
            />
          </pattern>

          {!isDark && (
            <radialGradient id="blueprint-beacon" cx="50%" cy="30%" r="55%">
              <stop offset="0%" stopColor="#FFF9F0" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#F7F1E7" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          )}
        </defs>

        <rect width="100%" height="100%" fill="url(#nexathon-blueprint-grid)" />

        {!isDark && (
          <rect width="100%" height="100%" fill="url(#blueprint-beacon)" />
        )}

        <g
          stroke={isDark ? 'rgba(36, 36, 36, 0.8)' : 'rgba(233, 222, 206, 0.7)'}
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
