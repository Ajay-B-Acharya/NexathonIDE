import React, { useEffect, useState, useRef } from 'react';

interface TrueFocusProps {
  sentence?: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
  className?: string;
}

export const TrueFocus: React.FC<TrueFocusProps> = ({
  sentence = 'Zero-Latency Cloud IDE Powered by WebAssembly & CRDTs',
  blurAmount = 3,
  borderColor = '#6366f1',
  glowColor = 'rgba(99, 102, 241, 0.45)',
  animationDuration = 0.4,
  pauseBetweenAnimations = 1.2,
  className = '',
}) => {
  const words = sentence.split(' ');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focusRect, setFocusRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseBetweenAnimations) * 1000);

    return () => clearInterval(interval);
  }, [words.length, animationDuration, pauseBetweenAnimations]);

  useEffect(() => {
    const currentWord = wordRefs.current[currentIndex];
    const container = containerRef.current;
    if (currentWord && container) {
      const wordBox = currentWord.getBoundingClientRect();
      const containerBox = container.getBoundingClientRect();

      setFocusRect({
        x: wordBox.left - containerBox.left,
        y: wordBox.top - containerBox.top,
        width: wordBox.width,
        height: wordBox.height,
      });
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 select-none ${className}`}
    >
      {words.map((word, idx) => {
        const isFocused = idx === currentIndex;
        return (
          <span
            key={idx}
            ref={(el) => {
              wordRefs.current[idx] = el;
            }}
            className="relative cursor-pointer transition-all duration-300 font-extrabold tracking-tight"
            style={{
              filter: isFocused ? 'blur(0px)' : `blur(${blurAmount}px)`,
              opacity: isFocused ? 1 : 0.55,
              transform: isFocused ? 'scale(1.04)' : 'scale(1)',
            }}
            onClick={() => setCurrentIndex(idx)}
          >
            {word}
          </span>
        );
      })}

      {/* Animated Corner Focus Brackets */}
      <div
        className="pointer-events-none absolute transition-all ease-out"
        style={{
          transform: `translate(${focusRect.x}px, ${focusRect.y}px)`,
          width: `${focusRect.width}px`,
          height: `${focusRect.height}px`,
          transitionDuration: `${animationDuration}s`,
        }}
      >
        {/* Top-Left Corner */}
        <span
          className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 transition-all"
          style={{ borderColor, boxShadow: `0 0 10px ${glowColor}` }}
        />
        {/* Top-Right Corner */}
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 transition-all"
          style={{ borderColor, boxShadow: `0 0 10px ${glowColor}` }}
        />
        {/* Bottom-Left Corner */}
        <span
          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 transition-all"
          style={{ borderColor, boxShadow: `0 0 10px ${glowColor}` }}
        />
        {/* Bottom-Right Corner */}
        <span
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 transition-all"
          style={{ borderColor, boxShadow: `0 0 10px ${glowColor}` }}
        />
      </div>
    </div>
  );
};

export default TrueFocus;

