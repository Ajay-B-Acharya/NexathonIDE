import React from 'react';

interface StarBorderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  color?: string;
  speed?: string;
  className?: string;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  color = '#FF7057',
  speed = '4s',
  className = '',
  ...props
}) => {
  return (
    <button
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-xl p-[1px] transition-all duration-300 focus:outline-none cursor-pointer ${className}`}
      {...props}
    >
      {/* Animated Rotating Gradient Border */}
      <span
        className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{
          background: `conic-gradient(from 90deg at 50% 50%, transparent 0%, ${color} 50%, transparent 100%)`,
          animationDuration: speed,
        }}
      />
      {/* Inner Button Canvas - High Contrast in both Day & Night */}
      <span className="relative inline-flex h-full w-full items-center justify-center rounded-[11px] bg-[#302820] text-white dark:bg-[#000000] dark:text-white px-4 py-2 text-xs font-semibold transition-colors group-hover:bg-opacity-90">
        {children}
      </span>
    </button>
  );
};

export default StarBorder;

