import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  decimals?: number;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.2,
  className = '',
  startWhen = true,
  separator = '',
  decimals,
}) => {
  const [currentValue, setCurrentValue] = useState<number>(from);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasStartedRef = useRef(false);

  // Automatically detect decimals if not explicitly passed
  const decimalCount =
    decimals !== undefined
      ? decimals
      : to.toString().includes('.')
      ? to.toString().split('.')[1].length
      : 0;

  useEffect(() => {
    if (!startWhen || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const timeout = setTimeout(() => {
      let startTime: number | null = null;
      const startVal = direction === 'down' ? to : from;
      const endVal = direction === 'down' ? from : to;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
        
        // Cubic ease out
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const val = startVal + (endVal - startVal) * easeOut;
        setCurrentValue(val);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setCurrentValue(endVal);
        }
      };

      requestAnimationFrame(step);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [to, from, direction, delay, duration, startWhen]);

  const formatted = currentValue.toLocaleString(undefined, {
    minimumFractionDigits: decimalCount,
    maximumFractionDigits: decimalCount,
  });

  return (
    <span ref={elementRef} className={className}>
      {separator ? formatted.replace(/,/g, separator) : formatted}
    </span>
  );
};

export default CountUp;

