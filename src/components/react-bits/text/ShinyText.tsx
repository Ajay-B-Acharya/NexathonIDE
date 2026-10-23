import React from 'react';

interface ShinyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  shineColor?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 3,
  className = '',
  shineColor,
  ...props
}) => {
  if (disabled) {
    return <span className={className} {...props}>{text}</span>;
  }

  return (
    <span
      className={`relative inline-block overflow-hidden bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(120deg, currentColor 0%, currentColor 38%, rgba(255,255,255,0.95) 50%, currentColor 62%, currentColor 100%)',
        backgroundSize: '200% 100%',
        animation: `shiny-sweep ${speed}s linear infinite`,
        WebkitBackgroundClip: 'text',
      }}
      {...props}
    >
      {text}
    </span>
  );
};

export default ShinyText;

