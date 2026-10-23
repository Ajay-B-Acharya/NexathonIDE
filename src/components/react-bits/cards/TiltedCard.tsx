import React, { useRef, useState, useCallback } from 'react';

interface TiltedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxAngle?: number;
  scale?: number;
  perspective?: number;
}

export const TiltedCard: React.FC<TiltedCardProps> = ({
  children,
  className = '',
  maxAngle = 6,
  scale = 1.01,
  perspective = 1000,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>(
    `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
  );
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate normalized -1 to +1 offsets
      const normalizedX = (x - centerX) / centerX;
      const normalizedY = (y - centerY) / centerY;

      const rotateY = normalizedX * maxAngle;
      const rotateX = -normalizedY * maxAngle;

      setTransform(
        `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, 1)`
      );
    },
    [maxAngle, perspective, scale]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTransform(
      `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    );
  }, [perspective]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: isHovered
          ? 'transform 0.1s ease-out'
          : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        transformStyle: 'preserve-3d',
      }}
      className={`will-change-transform transform-gpu ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default TiltedCard;

