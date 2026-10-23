import React, { useState } from 'react';

interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
  isOpen?: boolean;
}

export const Folder: React.FC<FolderProps> = ({
  color = '#00f0ff',
  size = 1,
  items = [],
  className = '',
  isOpen: controlledIsOpen,
}) => {
  const [hovered, setHovered] = useState(false);
  const open = controlledIsOpen !== undefined ? controlledIsOpen : hovered;

  const baseWidth = 84 * size;
  const baseHeight = 64 * size;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer transition-transform duration-300 ${className}`}
      style={{
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        perspective: '600px',
      }}
    >
      {/* Folder Back Plate with Tab */}
      <div
        className="absolute inset-0 rounded-lg shadow-md transition-colors duration-300"
        style={{
          backgroundColor: color,
          opacity: 0.85,
        }}
      >
        {/* Folder Top Tab */}
        <div
          className="absolute -top-2.5 left-2 h-3.5 rounded-t-md"
          style={{
            width: `${baseWidth * 0.42}px`,
            backgroundColor: color,
            opacity: 0.95,
          }}
        />
      </div>

      {/* Internal File Sheets that pop up on hover */}
      <div className="absolute inset-x-2 top-2 bottom-1 flex items-center justify-center">
        {items.slice(0, 3).map((item, idx) => {
          // Calculate stagger offset & rotation when open
          const translateY = open ? -(idx + 1) * 14 * size : 0;
          const rotateZ = open ? (idx === 0 ? -6 : idx === 2 ? 6 : 0) : 0;
          const scale = 1 - idx * 0.04;

          return (
            <div
              key={idx}
              className="absolute inset-x-1.5 h-full rounded border border-white/20 bg-white shadow-md transition-all duration-300 flex items-center justify-center overflow-hidden"
              style={{
                transform: `translate3d(0, ${translateY}px, ${idx * 4}px) rotateZ(${rotateZ}deg) scale(${scale})`,
                zIndex: 10 + idx,
                opacity: open ? 1 : 0.8 - idx * 0.2,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* Folder Front Flap that tilts open */}
      <div
        className="absolute inset-x-0 bottom-0 h-4/5 rounded-b-lg rounded-t-sm shadow-xl transition-all duration-300 origin-bottom"
        style={{
          backgroundColor: color,
          transform: open ? 'rotateX(-38deg) translateY(4px)' : 'rotateX(0deg)',
          boxShadow: open
            ? `0 12px 24px -4px ${color}55, 0 4px 8px rgba(0,0,0,0.4)`
            : '0 4px 10px rgba(0,0,0,0.3)',
          zIndex: 25,
          opacity: 0.95,
        }}
      >
        {/* Subtle decorative fold line */}
        <div className="absolute top-1 left-3 right-3 h-px bg-white/30" />
      </div>
    </div>
  );
};

export default Folder;

