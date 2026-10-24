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
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#000000]' : 'bg-[#F7F1E7]'
      }`}
      aria-hidden="true"
    >
      {/* =========================================================
          VARIANT 1: LANDING PAGE (Clean Blueprint Grid - Flat in Dark, Neumorphic in Light)
         ========================================================= */}
      {variant === 'landing' && (
        <>
          {/* Light Mode Soft Warm Ambient Tone (Disabled in Dark Mode to guarantee pure black) */}
          {!isDark && (
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full blur-[120px] opacity-35"
              style={{
                background:
                  'radial-gradient(circle, rgba(255, 112, 87, 0.12) 0%, rgba(241, 232, 218, 0.4) 60%, transparent 100%)',
              }}
            />
          )}

          {/* Blueprint Grid */}
          <div
            className="absolute inset-0 opacity-80"
            style={{
              maskImage: 'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 100%)',
              backgroundImage: isDark
                ? `
                  linear-gradient(to right, rgba(36, 36, 36, 0.7) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(36, 36, 36, 0.7) 1px, transparent 1px),
                  linear-gradient(to right, rgba(36, 36, 36, 0.25) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(36, 36, 36, 0.25) 1px, transparent 1px)
                `
                : `
                  linear-gradient(to right, rgba(233, 222, 206, 0.8) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(233, 222, 206, 0.8) 1px, transparent 1px),
                  linear-gradient(to right, rgba(233, 222, 206, 0.35) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(233, 222, 206, 0.35) 1px, transparent 1px)
                `,
              backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
            }}
          />

          {/* Architectural Crosshairs */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="cad-crosshairs" width="128" height="128" patternUnits="userSpaceOnUse">
                <path
                  d="M 124 128 L 132 128 M 128 124 L 128 132"
                  stroke={isDark ? '#242424' : '#E9DECE'}
                  strokeWidth="1.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cad-crosshairs)" />
          </svg>
        </>
      )}

      {/* =========================================================
          VARIANT 2: LOGIN PAGE (Circuit Mesh - Flat in Dark, Cream in Light)
         ========================================================= */}
      {variant === 'login' && (
        <>
          {!isDark && (
            <>
              <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#FFF9F0] blur-[120px] opacity-70" />
              <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#F1E8DA] blur-[120px] opacity-70" />
            </>
          )}

          <svg
            className="absolute inset-0 w-full h-full opacity-[0.25]"
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
                  stroke={isDark ? '#242424' : '#E9DECE'}
                  strokeWidth="1"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="1.5"
                  fill={isDark ? '#333333' : '#FF7057'}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#iso-circuit-grid)" />
          </svg>
        </>
      )}

      {/* =========================================================
          VARIANT 3: DASHBOARD (Micro-Dot Matrix)
         ========================================================= */}
      {variant === 'dashboard' && (
        <div
          className="absolute inset-0 opacity-50"
          style={{
            maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            backgroundImage: isDark
              ? `radial-gradient(rgba(36, 36, 36, 0.8) 1.25px, transparent 1.25px)`
              : `radial-gradient(rgba(200, 185, 168, 0.6) 1.25px, transparent 1.25px)`,
            backgroundSize: '24px 24px',
          }}
        />
      )}
    </div>
  );
};

export default AdaptiveBackground;
