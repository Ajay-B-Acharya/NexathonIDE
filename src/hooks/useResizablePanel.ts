import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizablePanelOptions {
  initialSize: number;
  minSize: number;
  maxSize: number;
  direction: 'horizontal' | 'vertical';
  invert?: boolean;
}

export function useResizablePanel({
  initialSize,
  minSize,
  maxSize,
  direction,
  invert = false,
}: UseResizablePanelOptions) {
  const [size, setSize] = useState<number>(initialSize);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startCoordRef = useRef<number>(0);
  const startSizeRef = useRef<number>(initialSize);

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(true);
      startCoordRef.current = direction === 'horizontal' ? event.clientX : event.clientY;
      startSizeRef.current = size;
    },
    [direction, size]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const currentCoord = direction === 'horizontal' ? event.clientX : event.clientY;
      const rawDelta = currentCoord - startCoordRef.current;
      const delta = invert ? -rawDelta : rawDelta;
      const nextSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + delta));
      setSize(nextSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction, minSize, maxSize, invert]);

  return {
    size,
    setSize,
    isDragging,
    startResize,
  };
}

