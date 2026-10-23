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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateDimensions();

    const PALETTE_DARK = [
      '#35B8A6', // Restrained Teal
      '#06b6d4', // Cyan
      '#3FBF86', // Emerald
      '#788797', // Slate
      '#38bdf8', // Sky
    ];

    const PALETTE_LIGHT = [
      '#168C7D', // Primary Accent Teal
      '#0284c7', // Sky Blue
      '#218653', // Emerald
      '#526171', // Slate
      '#0D9488', // Teal
    ];

    const nodeCount = Math.floor(Math.min(65, Math.max(32, (width * height) / 24000)));

    const nodes: PeerNode[] = Array.from({ length: nodeCount }, () => {
      const paletteIdx = Math.floor(Math.random() * PALETTE_DARK.length);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: 1.4 + Math.random() * 1.5,
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
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    const maxDistance = 140;
    const maxDistanceSq = maxDistance * maxDistance;
    const mouseRadius = 190;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);
      const isDark = theme === 'dark';

      // 1. Move & Wrap Nodes across the screen (Active in BOTH Day & Night modes)
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

      // 2. Draw Dynamic Inter-Node Vector Edges (Delicate silk lines in Light, glowing in Dark)
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
            const alpha = intensity * (isDark ? 0.16 : 0.09);

            ctx.lineWidth = isDark ? 1 : 0.8;
            ctx.strokeStyle = isDark
              ? `rgba(99, 102, 241, ${alpha})`
              : `rgba(79, 70, 229, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Spawn in-flight CRDT sync packets along active paths
            if (timestamp - lastPacketSpawn > 160 && packets.length < 20 && Math.random() < 0.04) {
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

      // 3. Connect Mouse as the Local Broker Node
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
            const alpha = intensity * (isDark ? 0.35 : 0.22);

            ctx.lineWidth = 1;
            ctx.strokeStyle = isDark
              ? `rgba(6, 182, 212, ${alpha})`
              : `rgba(2, 132, 199, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mx, my);
            ctx.stroke();

            // Gentle organic pull toward mouse
            n.vx += (dx / dist) * 0.01;
            n.vy += (dy / dist) * 0.01;
          }
        }

        // Soft radiant halo around mouse
        const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
        halo.addColorStop(
          0,
          isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(99, 102, 241, 0.08)'
        );
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(mx, my, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. In-Flight Moving CRDT Sync Packets (Active in BOTH modes)
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
        ctx.shadowColor = p.color;
        ctx.shadowBlur = isDark ? 8 : 4;
        ctx.beginPath();
        ctx.arc(currX, currY, isDark ? 1.8 : 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 5. Draw Glowing Peer Nodes with Pulsing Radii
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = Math.sin(n.pulsePhase) * 0.5;
        const currentRadius = Math.max(1.1, n.radius + pulse);
        const color = isDark ? n.colorDark : n.colorLight;

        // Outer soft glow halo
        ctx.fillStyle = color;
        ctx.globalAlpha = isDark ? 0.35 : 0.18;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid core
        ctx.globalAlpha = isDark ? 0.9 : 0.65;
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
