import React, { useRef, useEffect, useCallback } from 'react';

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

interface ClickSparkProps extends React.HTMLAttributes<HTMLDivElement> {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children: React.ReactNode;
}

export const ClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor = '#6366f1',
  sparkSize = 10,
  sparkRadius = 18,
  sparkCount = 8,
  duration = 420,
  children,
  className = '',
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;

        const progress = elapsed / duration;
        const easeOutProgress = 1 - Math.pow(1 - progress, 3);

        const currentDistance = easeOutProgress * sparkRadius;
        const currentLength = (1 - progress) * sparkSize;

        const x1 = spark.x + Math.cos(spark.angle) * currentDistance;
        const y1 = spark.y + Math.sin(spark.angle) * currentDistance;
        const x2 = spark.x + Math.cos(spark.angle) * (currentDistance + currentLength);
        const y2 = spark.y + Math.sin(spark.angle) * (currentDistance + currentLength);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 1.75 * (1 - progress);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      if (sparksRef.current.length > 0) {
        requestAnimationFrame(animate);
      }
    },
    [duration, sparkColor, sparkRadius, sparkSize]
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = performance.now();
    const wasEmpty = sparksRef.current.length === 0;

    for (let i = 0; i < sparkCount; i++) {
      const angle = (i * 2 * Math.PI) / sparkCount;
      sparksRef.current.push({ x, y, angle, startTime: now });
    }

    if (wasEmpty) {
      requestAnimationFrame(animate);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-full ${className}`}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50 h-full w-full"
      />
      {children}
    </div>
  );
};

export default ClickSpark;

