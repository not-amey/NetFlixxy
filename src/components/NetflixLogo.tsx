import React from 'react';
import logoPng from '../assets/logo.png';

/**
 * NetFlixxy App Logo Icon
 */
export const NetflixNIcon: React.FC<{ size?: number; className?: string; width?: number; height?: number }> = ({
  size = 28,
  width,
  height,
  className = ''
}) => {
  const w = width || size;
  const h = height || size;
  return (
    <img
      src={logoPng}
      alt="NetFlixxy"
      width={w}
      height={h}
      className={className}
      style={{
        width: `${w}px`,
        height: `${h}px`,
        objectFit: 'contain',
        background: 'transparent',
        borderRadius: 0,
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    />
  );
};

/**
 * NetFlixxy Header Wordmark
 */
export const NetflixWordmark: React.FC<{ height?: number }> = ({ height = 28 }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        background: 'transparent'
      }}
    >
      <img
        src={logoPng}
        alt="NetFlixxy"
        style={{
          width: `${height}px`,
          height: `${height}px`,
          objectFit: 'contain',
          background: 'transparent',
          borderRadius: 0
        }}
      />
      <span
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 900,
          fontSize: `${height * 0.85}px`,
          letterSpacing: '0.04em',
          color: '#E50914',
          textTransform: 'uppercase'
        }}
      >
        NetFlixxy
      </span>
    </div>
  );
};

/**
 * NetFlixxy Brand Badge for cards
 */
export const NetflixBadge: React.FC<{ size?: number }> = ({ size = 16 }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent'
      }}
    >
      <img
        src={logoPng}
        alt="NetFlixxy"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          background: 'transparent',
          borderRadius: 0
        }}
      />
    </div>
  );
};
