import React, { useEffect, useRef } from 'react';
import { ThemeMode } from './ThemeToggle';

interface AmbientCollaborationCanvasProps {
  theme: ThemeMode;
}

interface PeerNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  colorDark: string;
  colorLight: string;
}

interface SyncPacket {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
  color: string;
}

export const AmbientCollaborationCanvas: React.FC<AmbientCollaborationCanvasProps> = ({
  theme,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const updateDimensions = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    updateDimensions();

    const PALETTE_DARK = [
      '#FF7057', // Primary Accent
      '#FFFFFF', // Primary text
      '#B3B3B3', // Secondary text
      '#808080', // Muted text
      '#F26049', // Pressed Accent
    ];

    const PALETTE_LIGHT = [
      '#FF7057', // Primary Accent
      '#302820', // Primary text dark brown
      '#756858', // Secondary text
      '#8A7D6D', // Muted text
      '#E9DECE', // Warm Border
    ];

    const nodeCount = Math.floor(Math.min(60, Math.max(28, (width * height) / 26000)));

    const nodes: PeerNode[] = Array.from({ length: nodeCount }, () => {
      const paletteIdx = Math.floor(Math.random() * PALETTE_DARK.length);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 1.2 + Math.random() * 1.4,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02,
        colorDark: PALETTE_DARK[paletteIdx],
        colorLight: PALETTE_LIGHT[paletteIdx],
      };
    });

    const packets: SyncPacket[] = [];
    let lastPacketSpawn = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const maxDistance = 140;
    const maxDistanceSq = maxDistance * maxDistance;
    const mouseRadius = 180;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);
      const isDark = theme === 'dark';

      // 1. Move & Wrap Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < -20) n.x = width + 20;
        else if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        else if (n.y > height + 20) n.y = -20;

        n.pulsePhase += n.pulseSpeed;
      }

      // 2. Draw Dynamic Inter-Node Vector Edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistanceSq) {
            const dist = Math.sqrt(distSq);
            const intensity = (1 - dist / maxDistance);
            const alpha = intensity * (isDark ? 0.22 : 0.15);

            ctx.lineWidth = isDark ? 0.8 : 0.8;
            ctx.strokeStyle = isDark
              ? `rgba(36, 36, 36, ${alpha})`
              : `rgba(233, 222, 206, ${alpha * 2})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Spawn in-flight CRDT sync packets
            if (timestamp - lastPacketSpawn > 180 && packets.length < 18 && Math.random() < 0.04) {
              packets.push({
                fromX: a.x,
                fromY: a.y,
                toX: b.x,
                toY: b.y,
                progress: 0,
                speed: 0.016 + Math.random() * 0.02,
                color: isDark ? a.colorDark : a.colorLight,
              });
              lastPacketSpawn = timestamp;
            }
          }
        }
      }

      // 3. Connect Mouse as Local Broker Node
      if (mouseRef.current.active) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dx = mx - n.x;
          const dy = my - n.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < mouseRadiusSq) {
            const dist = Math.sqrt(distSq);
            const intensity = 1 - dist / mouseRadius;
            const alpha = intensity * (isDark ? 0.35 : 0.25);

            ctx.lineWidth = 1;
            ctx.strokeStyle = isDark
              ? `rgba(255, 112, 87, ${alpha * 0.6})`
              : `rgba(255, 112, 87, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mx, my);
            ctx.stroke();

            n.vx += (dx / dist) * 0.01;
            n.vy += (dy / dist) * 0.01;
          }
        }
      }

      // 4. In-Flight Moving CRDT Sync Packets (Zero glow in dark mode)
      ctx.shadowBlur = 0;
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.progress += p.speed;

        if (p.progress >= 1) {
          packets.splice(i, 1);
          continue;
        }

        const currX = p.fromX + (p.toX - p.fromX) * p.progress;
        const currY = p.fromY + (p.toY - p.fromY) * p.progress;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(currX, currY, isDark ? 1.5 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Draw Clean Flat Peer Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = Math.sin(n.pulsePhase) * 0.4;
        const currentRadius = Math.max(1.0, n.radius + pulse);
        const color = isDark ? n.colorDark : n.colorLight;

        // In Dark mode: flat, no outer glowing halo. In Light mode: subtle warm tone
        if (!isDark) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Solid core
        ctx.fillStyle = color;
        ctx.globalAlpha = isDark ? 0.85 : 0.75;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 opacity-80"
      aria-hidden="true"
    />
  );
};
