import React, { useEffect, useState, useRef } from 'react';

export interface SkipBadgeData {
  appliedDelta: number; // accumulated signed seconds actually applied
  destination: number;  // clamped destination in seconds
  duration: number;     // video duration
  direction: 'forward' | 'back';
  pressCount: number;   // incremented on each press
}

interface SkipBadgeProps {
  data: SkipBadgeData | null;
  onExited?: () => void;
}

export function formatBadgeTime(seconds: number, forceHours = false): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0 || forceHours) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const SkipBadge: React.FC<SkipBadgeProps> = ({ data, onExited }) => {
  const [mounted, setMounted] = useState(false);
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [pulse, setPulse] = useState(false);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (!data) {
      if (isVisibleRef.current) {
        startFadeOut();
      }
      return;
    }

    // Repeated press while already visible
    if (isVisibleRef.current) {
      setPulse(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => {
        setPulse(false);
      }, 80);

      // Reset the 600ms hold timer
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        startFadeOut();
      }, 600);
      return;
    }

    // Fresh appearance
    setMounted(true);
    isVisibleRef.current = true;
    setAnimState('entering');
    setPulse(false);

    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    animTimerRef.current = setTimeout(() => {
      setAnimState('visible');
    }, 10);

    holdTimerRef.current = setTimeout(() => {
      startFadeOut();
    }, 600);
  }, [data?.pressCount, data?.destination, data?.appliedDelta]);

  const startFadeOut = () => {
    isVisibleRef.current = false;
    setAnimState('exiting');
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => {
      setAnimState('hidden');
      setMounted(false);
      if (onExited) onExited();
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  if (!mounted || !data || animState === 'hidden') return null;

  const isEntering = animState === 'entering';
  const isExiting = animState === 'exiting';

  // Motion: fade in over 120 ms (ease-out), hold 600 ms, fade out over 300 ms (ease-in)
  // Animate only opacity and transform. No bounce.
  const opacity = (isEntering || isExiting) ? 0 : 0.92;
  const transform = isEntering ? 'translateY(-6px)' : isExiting ? 'translateY(-4px)' : 'translateY(0)';
  const transition = isExiting
    ? 'opacity 300ms ease-in, transform 300ms ease-in'
    : 'opacity 120ms ease-out, transform 120ms ease-out';

  const isOverHour = data.duration >= 3600;
  const timeText = `${formatBadgeTime(data.destination, isOverHour)} / ${formatBadgeTime(data.duration, isOverHour)}`;
  const sign = data.appliedDelta >= 0 ? '+' : '−';
  const absAmount = Math.abs(data.appliedDelta);
  const deltaText = `${sign}${absAmount} s`;

  // Pulse icon 15 degrees: forward +15deg, back -15deg
  const pulseAngle = pulse ? (data.direction === 'forward' ? 15 : -15) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(24px + 2cm)',
        left: 'calc(24px + 1.5cm)',
        zIndex: 300,
        pointerEvents: 'none',
        background: 'none',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        opacity,
        transform,
        transition,
        color: 'rgba(255, 255, 255, 0.92)',
        filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6))',
        userSelect: 'none'
      }}
    >
      {/* 28px circular arrow with 5 in middle, red ring */}
      <div
        style={{
          width: '28px',
          height: '28px',
          flexShrink: 0,
          transform: `rotate(${pulseAngle}deg)`,
          transition: 'transform 80ms ease-out'
        }}
      >
        {data.direction === 'forward' ? (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 14 4 A 10 10 0 1 1 5.8 19.5"
              stroke="#E50914"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 12 1.5 L 16 4 L 12 6.5"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <text
              x="14"
              y="14.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(255, 255, 255, 0.92)"
              fontSize="11"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              5
            </text>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 14 4 A 10 10 0 1 0 22.2 19.5"
              stroke="#E50914"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 16 1.5 L 12 4 L 16 6.5"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <text
              x="14"
              y="14.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(255, 255, 255, 0.92)"
              fontSize="11"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              5
            </text>
          </svg>
        )}
      </div>

      {/* Two lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '70px' }}>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.92)',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          {deltaText}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          {timeText}
        </div>
      </div>
    </div>
  );
};
