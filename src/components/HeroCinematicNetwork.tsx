import React, { useEffect, useRef } from 'react';
import { ThemeMode } from './ThemeToggle';

interface HeroCinematicNetworkProps {
  theme: ThemeMode;
}

export const HeroCinematicNetwork: React.FC<HeroCinematicNetworkProps> = ({ theme }) => {
  const isDark = theme !== 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const targetOffset = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Check for touch device or prefers-reduced-motion
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 24; // Subtle max 12px shift
      const y = (e.clientY / innerHeight - 0.5) * 16; // Subtle max 8px shift
      targetOffset.current = { x, y };
    };

    const animate = () => {
      // Smooth lerp
      currentOffset.current.x += (targetOffset.current.x - currentOffset.current.x) * 0.05;
      currentOffset.current.y += (targetOffset.current.y - currentOffset.current.y) * 0.05;

      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${currentOffset.current.x.toFixed(2)}px, ${currentOffset.current.y.toFixed(2)}px, 0)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Theme-aware color variables for SVG
  const strokeColor = isDark ? 'rgba(255, 112, 87, 0.22)' : 'rgba(255, 112, 87, 0.28)';
  const secondaryStroke = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(180, 160, 140, 0.35)';
  const nodeFill = isDark ? '#171717' : '#FFFDF9';
  const nodeStroke = isDark ? 'rgba(255, 112, 87, 0.8)' : '#FF7057';
  const accentCyan = isDark ? '#38BDF8' : '#0284C7';
  const accentIndigo = isDark ? '#818CF8' : '#6366F1';

  return (
    <div
      ref={containerRef}
      className="hero-cinematic-network-root pointer-events-none absolute inset-0 -z-10 overflow-hidden flex items-center justify-center select-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[1400px] object-cover opacity-90 transition-opacity duration-700"
      >
        <defs>
          {/* Gradients for glowing connection rails */}
          <linearGradient id="coralToCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF7057" stopOpacity="0.8" />
            <stop offset="100%" stopColor={accentCyan} stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="coralToIndigo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF7057" stopOpacity="0.8" />
            <stop offset="100%" stopColor={accentIndigo} stopOpacity="0.8" />
          </linearGradient>

          <radialGradient id="hubAmbientGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF7057" stopOpacity={isDark ? "0.22" : "0.15"} />
            <stop offset="60%" stopColor="#FF7057" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#FF7057" stopOpacity="0" />
          </radialGradient>

          {/* Pulse Filter */}
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. CENTRAL AMBIENT RADIAL LIGHT SPOT (Focal point behind the hero logo at 600, 220) */}
        <circle cx="600" cy="220" r="260" fill="url(#hubAmbientGlow)" className="cinematic-hub-glow" />

        {/* 2. RADIAL APERTURE EXPANSION RINGS (Phase 1 & 2 awakening) */}
        <circle cx="600" cy="220" r="50" stroke="#FF7057" strokeWidth="1.5" className="cinematic-radar-ring ring-1" />
        <circle cx="600" cy="220" r="110" stroke="#FF7057" strokeWidth="1" strokeDasharray="6 4" className="cinematic-radar-ring ring-2" />
        <circle cx="600" cy="220" r="190" stroke={secondaryStroke} strokeWidth="1" strokeDasharray="3 5" className="cinematic-radar-ring ring-3" />
        <circle cx="600" cy="220" r="320" stroke={secondaryStroke} strokeWidth="0.75" className="cinematic-radar-ring ring-4" />

        {/* 3. BACKGROUND ARCHITECTURAL GRID RAILS (Thin structural lines) */}
        {/* Horizontal Alignment Rails */}
        <line x1="100" y1="220" x2="1100" y2="220" stroke={secondaryStroke} strokeWidth="1" strokeDasharray="4 6" className="cinematic-rail rail-h-center" />
        <line x1="150" y1="120" x2="1050" y2="120" stroke={secondaryStroke} strokeWidth="0.75" className="cinematic-rail" />
        <line x1="120" y1="360" x2="1080" y2="360" stroke={secondaryStroke} strokeWidth="0.75" strokeDasharray="5 5" className="cinematic-rail" />
        <line x1="200" y1="520" x2="1000" y2="520" stroke={secondaryStroke} strokeWidth="0.75" className="cinematic-rail" />

        {/* Vertical Alignment Rails */}
        <line x1="600" y1="60" x2="600" y2="680" stroke={secondaryStroke} strokeWidth="1" strokeDasharray="6 4" className="cinematic-rail rail-v-center" />
        <line x1="380" y1="100" x2="380" y2="620" stroke={secondaryStroke} strokeWidth="0.75" className="cinematic-rail" />
        <line x1="820" y1="100" x2="820" y2="620" stroke={secondaryStroke} strokeWidth="0.75" className="cinematic-rail" />

        {/* 4. DISTRIBUTED COLLABORATION NETWORK PATHS (Drawn dynamically) */}
        {/* Path: West Cluster to Center Hub */}
        <path
          d="M 220 360 L 380 360 L 480 280 L 600 220"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          className="cinematic-network-path path-west-center"
        />

        {/* Path: East Cluster to Center Hub */}
        <path
          d="M 980 360 L 820 360 L 720 280 L 600 220"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          className="cinematic-network-path path-east-center"
        />

        {/* Path: Top North-West to Center */}
        <path
          d="M 320 120 L 460 120 L 540 180 L 600 220"
          stroke="url(#coralToCyan)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="cinematic-network-path path-nw-center"
        />

        {/* Path: Top North-East to Center */}
        <path
          d="M 880 120 L 740 120 L 660 180 L 600 220"
          stroke="url(#coralToIndigo)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="cinematic-network-path path-ne-center"
        />

        {/* Path: South Mesh Distribution Loop */}
        <path
          d="M 380 520 L 500 520 L 600 440 L 700 520 L 820 520"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="4 4"
          className="cinematic-network-path path-south-mesh"
        />

        {/* Cross Vertical Synapse */}
        <path
          d="M 600 220 L 600 440"
          stroke="#FF7057"
          strokeWidth="2"
          strokeLinecap="round"
          className="cinematic-network-path path-vertical-synapse"
        />

        {/* Diagonal Cross Links */}
        <line x1="380" y1="360" x2="500" y2="520" stroke={strokeColor} strokeWidth="1" className="cinematic-network-path path-diag-1" />
        <line x1="820" y1="360" x2="700" y2="520" stroke={strokeColor} strokeWidth="1" className="cinematic-network-path path-diag-2" />

        {/* 5. TRAVELING DATA PACKETS / LIGHT PULSES ALONG RAILS */}
        {/* Packet 1: West -> Center */}
        <circle r="3.5" fill="#FF7057" filter="url(#glowFilter)" className="cinematic-packet packet-west" />
        {/* Packet 2: East -> Center */}
        <circle r="3.5" fill={accentCyan} filter="url(#glowFilter)" className="cinematic-packet packet-east" />
        {/* Packet 3: Vertical Center Downward */}
        <circle r="4" fill="#FF7057" filter="url(#glowFilter)" className="cinematic-packet packet-vertical" />
        {/* Packet 4: North-West Diagonal */}
        <circle r="3" fill={accentIndigo} filter="url(#glowFilter)" className="cinematic-packet packet-nw" />

        {/* 6. DISTRIBUTED NODES (Collaborator Peer Terminals) */}
        {/* Node West Alpha */}
        <g className="cinematic-node node-w1" transform="translate(220, 360)">
          <circle r="9" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="4" fill="#FF7057" className="cinematic-node-pulse" />
        </g>

        {/* Node West Junction */}
        <g className="cinematic-node node-w2" transform="translate(380, 360)">
          <circle r="8" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="3" fill={accentCyan} className="cinematic-node-pulse" />
        </g>

        {/* Node North-West */}
        <g className="cinematic-node node-nw" transform="translate(320, 120)">
          <circle r="7" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="2.5" fill="#FF7057" />
        </g>

        {/* Node East Alpha */}
        <g className="cinematic-node node-e1" transform="translate(980, 360)">
          <circle r="9" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="4" fill="#FF7057" className="cinematic-node-pulse" />
        </g>

        {/* Node East Junction */}
        <g className="cinematic-node node-e2" transform="translate(820, 360)">
          <circle r="8" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="3" fill={accentIndigo} className="cinematic-node-pulse" />
        </g>

        {/* Node North-East */}
        <g className="cinematic-node node-ne" transform="translate(880, 120)">
          <circle r="7" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="2.5" fill={accentCyan} />
        </g>

        {/* Node South-West */}
        <g className="cinematic-node node-sw" transform="translate(380, 520)">
          <circle r="7" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="2.5" fill="#FF7057" />
        </g>

        {/* Node South-East */}
        <g className="cinematic-node node-se" transform="translate(820, 520)">
          <circle r="7" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
          <circle r="2.5" fill={accentCyan} />
        </g>

        {/* Node South Central Intersection */}
        <g className="cinematic-node node-sc" transform="translate(600, 440)">
          <circle r="10" fill={nodeFill} stroke="#FF7057" strokeWidth="2" />
          <circle r="4" fill="#FF7057" className="cinematic-node-pulse" />
        </g>

        {/* Central Master Synchronizer Hub (Directly under the hero logo) */}
        <g className="cinematic-node node-master" transform="translate(600, 220)">
          <circle r="16" fill="none" stroke="#FF7057" strokeWidth="1" strokeDasharray="3 3" className="cinematic-hub-ring" />
          <circle r="8" fill={nodeFill} stroke="#FF7057" strokeWidth="2" />
          <circle r="3.5" fill="#FF7057" />
        </g>
      </svg>
    </div>
  );
};
