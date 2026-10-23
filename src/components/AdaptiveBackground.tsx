import React from 'react';
import { ThemeMode } from './ThemeToggle';

interface AdaptiveBackgroundProps {
  variant: 'landing' | 'login' | 'dashboard';
  theme?: ThemeMode;
}

export const AdaptiveBackground: React.FC<AdaptiveBackgroundProps> = ({
  variant,
  theme,
}) => {
  const isDark = theme !== 'light';

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-500 ${
        isDark ? 'bg-[#06080e]' : 'bg-[#f8fafc]'
      }`}
      aria-hidden="true"
    >
      {/* =========================================================
          VARIANT 1: LANDING PAGE (Architectural CAD Grid + Aurora)
         ========================================================= */}
      {variant === 'landing' && (
        <>
          {/* Top Vibrant Aurora Glow (Adjusts intensity for Day vs Night) */}
          <div
            className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] rounded-full blur-[110px] transition-opacity duration-700 ${
              isDark ? 'opacity-55' : 'opacity-25'
            }`}
            style={{
              background:
                'radial-gradient(circle, rgba(0,240,255,0.6) 0%, rgba(99,102,241,0.5) 45%, rgba(16,185,129,0.3) 80%, transparent 100%)',
            }}
          />

          {/* Major 64px Blueprint Grid + Minor 16px Sub-Grid (Visible in both modes!) */}
          <div
            className="absolute inset-0 opacity-70 dark:opacity-100"
            style={{
              maskImage: 'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 100%)',
              backgroundImage: isDark
                ? `
                  linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
                  linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
                `
                : `
                  linear-gradient(to right, rgba(15, 23, 42, 0.08) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(15, 23, 42, 0.08) 1px, transparent 1px),
                  linear-gradient(to right, rgba(15, 23, 42, 0.03) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(15, 23, 42, 0.03) 1px, transparent 1px)
                `,
              backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
            }}
          />

          {/* Architectural Crosshairs at Grid Intersections */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30 dark:opacity-25"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="cad-crosshairs" width="128" height="128" patternUnits="userSpaceOnUse">
                <path
                  d="M 124 128 L 132 128 M 128 124 L 128 132"
                  stroke={isDark ? '#00f0ff' : '#4f46e5'}
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cad-crosshairs)" />
          </svg>
        </>
      )}

      {/* =========================================================
          VARIANT 2: LOGIN PAGE (Cryptographic Topographical Mesh)
         ========================================================= */}
      {variant === 'login' && (
        <>
          {/* Dual Corner Ambient Beams */}
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/15 dark:bg-cyan-500/20 blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-500/15 dark:bg-indigo-500/20 blur-[120px]" />

          {/* Diagonal Isometric Circuit Lines with Junction Nodes */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.16] dark:opacity-[0.18]"
            style={{
              maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="iso-circuit-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path
                  d="M 0 24 L 24 0 L 48 24 L 24 48 Z"
                  fill="none"
                  stroke={isDark ? '#00f0ff' : '#475569'}
                  strokeWidth="1"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="1.5"
                  fill={isDark ? '#00f0ff' : '#4f46e5'}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#iso-circuit-grid)" />
          </svg>
        </>
      )}

      {/* =========================================================
          VARIANT 3: DASHBOARD (Precision Micro-Dot Matrix)
         ========================================================= */}
      {variant === 'dashboard' && (
        <>
          {/* Subtle Top-Right Header Glow */}
          <div className="absolute top-0 right-1/4 w-[700px] h-[250px] bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 dark:from-cyan-500/15 dark:via-indigo-500/15 dark:to-emerald-500/15 blur-[100px]" />

          {/* High-Contrast Precision Dot Matrix (Zero clutter behind workspace cards) */}
          <div
            className="absolute inset-0 opacity-60 dark:opacity-45"
            style={{
              maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
              backgroundImage: isDark
                ? `radial-gradient(rgba(148, 163, 184, 0.35) 1.25px, transparent 1.25px)`
                : `radial-gradient(rgba(100, 116, 139, 0.45) 1.25px, transparent 1.25px)`,
              backgroundSize: '24px 24px',
            }}
          />
        </>
      )}

      {/* =========================================================
          GLOBAL FILM GRAIN TEXTURE (Prevents color banding in both modes)
         ========================================================= */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default AdaptiveBackground;

