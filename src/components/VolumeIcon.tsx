import React from 'react';

export interface VolumeIconProps {
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  isAnimating?: boolean;
}

export const VolumeIcon: React.FC<VolumeIconProps> = ({
  volume,
  isMuted,
  size = 24,
  className,
  style,
  isAnimating = false
}) => {
  const pct = Math.round(volume * 100);
  const showX = isMuted || pct === 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'block',
        flexShrink: 0,
        ...style
      }}
    >
      {/* Centered Speaker Body: 2px stroke, round caps and joins */}
      <path
        d="M3 9h3.5l5-5v16l-5-5H3V9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showX ? (
        /* Speaker with an X (Muted or 0%): 2px stroke, round caps */
        <path
          d="M16 9.5l5 5M21 9.5l-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        /* Evenly spaced sound waves at x=14, 17, 20: 2px stroke, round caps */
        <>
          {/* Wave 1: 1% to 100% */}
          {pct >= 1 && (
            <path
              d="M14 9.5a4 4 0 0 1 0 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isAnimating ? 'animate-volume-bar-1' : undefined}
              style={{ transformOrigin: '14px 12px' }}
            />
          )}

          {/* Wave 2: 34% to 100% */}
          {pct >= 34 && (
            <path
              d="M17 7a7.5 7.5 0 0 1 0 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isAnimating ? 'animate-volume-bar-2' : undefined}
              style={{ transformOrigin: '17px 12px' }}
            />
          )}

          {/* Wave 3: 67% to 100% */}
          {pct >= 67 && (
            <path
              d="M20 4.5a11 11 0 0 1 0 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isAnimating ? 'animate-volume-bar-3' : undefined}
              style={{ transformOrigin: '20px 12px' }}
            />
          )}
        </>
      )}
    </svg>
  );
};
