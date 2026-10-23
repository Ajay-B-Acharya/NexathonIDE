import React, { useState, useRef, useCallback } from 'react';

interface ElasticSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label?: string;
  onChange: (val: number) => void;
  className?: string;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  suffix = '',
  label,
  onChange,
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [elasticOffset, setElasticOffset] = useState(0);

  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  const calculateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const ratio = rawX / rect.width;

      if (ratio < 0) {
        setElasticOffset(Math.max(rawX * 0.2, -18));
      } else if (ratio > 1) {
        setElasticOffset(Math.min((rawX - rect.width) * 0.2, 18));
      } else {
        setElasticOffset(0);
      }

      const clampedRatio = Math.min(Math.max(ratio, 0), 1);
      const rawVal = min + clampedRatio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      return Math.min(Math.max(steppedVal, min), max);
    },
    [min, max, step, value]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const nextVal = calculateValue(e.clientX);
    onChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const nextVal = calculateValue(e.clientX);
    onChange(nextVal);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setElasticOffset(0);
  };

  return (
    <div className={`space-y-1.5 select-none ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="theme-text-secondary">{label}</span>
          <span className="font-semibold text-indigo-500 dark:text-indigo-400">
            {value} {suffix}
          </span>
        </div>
      )}

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-6 flex items-center cursor-pointer touch-none"
      >
        {/* Track Background */}
        <div className="h-2 w-full rounded-full theme-bg-surface-2 border theme-border overflow-hidden relative">
          <div
            style={{ width: `${percentage}%` }}
            className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full transition-all duration-75"
          />
        </div>

        {/* Thumb with elastic rubber-band physics */}
        <div
          style={{
            left: `calc(${percentage}% + ${elasticOffset}px)`,
            transform: `translateX(-50%) scale(${isDragging ? 1.25 : 1})`,
          }}
          className={`absolute h-4 w-4 rounded-full bg-white border-2 border-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-transform duration-100 ease-out`}
        />
      </div>
    </div>
  );
};

export default ElasticSlider;

