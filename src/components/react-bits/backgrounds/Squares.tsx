import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SquaresProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  direction?: 'diagonal' | 'up' | 'down' | 'left' | 'right';
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
}

export const Squares: React.FC<SquaresProps> = ({
  direction = 'diagonal',
  speed = 0.5,
  borderColor,
  squareSize = 40,
  hoverFillColor,
  className = '',
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const numSquaresX = useRef<number>(0);
  const numSquaresY = useRef<number>(0);
  const gridOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      numSquaresX.current = Math.ceil(canvas.offsetWidth / squareSize) + 1;
      numSquaresY.current = Math.ceil(canvas.offsetHeight / squareSize) + 1;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const isDarkMode = document.documentElement.classList.contains('dark');
      const resolvedBorder =
        borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.05)');
      const resolvedHover =
        hoverFillColor || (isDarkMode ? 'rgba(99, 102, 241, 0.14)' : 'rgba(99, 102, 241, 0.08)');

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      for (let x = startX; x < canvas.offsetWidth + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.offsetHeight + squareSize; y += squareSize) {
          const squareX = x - (gridOffset.current.x % squareSize);
          const squareY = y - (gridOffset.current.y % squareSize);

          if (
            hoveredSquare &&
            Math.floor((squareX + (gridOffset.current.x % squareSize)) / squareSize) ===
              hoveredSquare.x &&
            Math.floor((squareY + (gridOffset.current.y % squareSize)) / squareSize) ===
              hoveredSquare.y
          ) {
            ctx.fillStyle = resolvedHover;
            ctx.fillRect(squareX, squareY, squareSize, squareSize);
          }

          ctx.strokeStyle = resolvedBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(squareX, squareY, squareSize, squareSize);
        }
      }

      // Movement vector
      switch (direction) {
        case 'right':
          gridOffset.current.x -= speed;
          break;
        case 'left':
          gridOffset.current.x += speed;
          break;
        case 'down':
          gridOffset.current.y -= speed;
          break;
        case 'up':
          gridOffset.current.y += speed;
          break;
        case 'diagonal':
          gridOffset.current.x -= speed * 0.7;
          gridOffset.current.y -= speed * 0.7;
          break;
      }

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [direction, speed, borderColor, hoverFillColor, squareSize, hoveredSquare]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const hoveredX = Math.floor(
        (mouseX + (gridOffset.current.x % squareSize)) / squareSize
      );
      const hoveredY = Math.floor(
        (mouseY + (gridOffset.current.y % squareSize)) / squareSize
      );

      setHoveredSquare({ x: hoveredX, y: hoveredY });
    },
    [squareSize]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredSquare(null);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto h-full w-full ${className}`}
      {...props}
    />
  );
};

export default Squares;

