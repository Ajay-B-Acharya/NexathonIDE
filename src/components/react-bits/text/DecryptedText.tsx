import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DecryptedTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover' | 'mount';
}

const DEFAULT_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]:;<>,.?~';

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 35,
  maxIterations = 10,
  sequential = true,
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = 'opacity-60 font-mono text-indigo-400',
  animateOn = 'view',
  ...props
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isRevealed, setIsRevealed] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  const startDecryption = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    let iteration = 0;
    const textLength = text.length;

    intervalRef.current = window.setInterval(() => {
      setDisplayText((prev) => {
        const nextChars = text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (sequential) {
              const threshold = (iteration / maxIterations) * textLength;
              if (index < threshold) {
                return text[index];
              }
            } else {
              if (iteration >= maxIterations) {
                return text[index];
              }
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('');

        return nextChars;
      });

      iteration += 1;
      if (iteration > (sequential ? maxIterations * 1.5 : maxIterations)) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsRevealed(true);
      }
    }, speed);
  }, [text, speed, maxIterations, sequential, characters]);

  useEffect(() => {
    if (animateOn === 'mount') {
      startDecryption();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    if (animateOn === 'view') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimatedRef.current) {
              hasAnimatedRef.current = true;
              startDecryption();
            }
          });
        },
        { threshold: 0.1 }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => {
        observer.disconnect();
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animateOn, startDecryption]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover') {
      startDecryption();
    }
  };

  return (
    <span
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      className={`inline-block select-none ${className}`}
      {...props}
    >
      <span className={isRevealed ? '' : encryptedClassName}>{displayText}</span>
    </span>
  );
};

export default DecryptedText;

