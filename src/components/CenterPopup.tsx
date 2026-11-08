import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { VolumeIcon } from './VolumeIcon';

export type CenterPopupType = 'play' | 'pause' | 'mute' | 'unmute' | 'volume';

export interface CenterPopupPayload {
  type: CenterPopupType;
  text?: string;
  volume?: number;
  isMuted?: boolean;
}

export interface CenterPopupRef {
  trigger: (payload: CenterPopupPayload) => void;
}

export const CenterPopup = forwardRef<CenterPopupRef, {}>((_props, ref) => {
  const [mounted, setMounted] = useState(false);
  const [animState, setAnimState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [payload, setPayload] = useState<CenterPopupPayload>({ type: 'play' });

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);

  const trigger = (newPayload: CenterPopupPayload) => {
    setPayload(newPayload);

    // If already mounted and visible / entering, just update without scaling the icon
    if (isVisibleRef.current) {
      // Reset the 600ms hold timer
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        startFadeOut();
      }, 600);
      return;
    }

    // Otherwise, start fade in over 120ms
    setMounted(true);
    isVisibleRef.current = true;
    setAnimState('entering');

    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    // Transition to visible in next tick so CSS transition runs
    animTimerRef.current = setTimeout(() => {
      setAnimState('visible');
    }, 10);

    // Hold for 600ms then fade out
    holdTimerRef.current = setTimeout(() => {
      startFadeOut();
    }, 600);
  };

  const startFadeOut = () => {
    isVisibleRef.current = false;
    setAnimState('exiting');
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    // Fade out over 300ms, then hide
    animTimerRef.current = setTimeout(() => {
      setAnimState('hidden');
      setMounted(false);
    }, 300);
  };

  useImperativeHandle(ref, () => ({
    trigger
  }));

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const isEntering = animState === 'entering';
  const isExiting = animState === 'exiting';
  const isHidden = animState === 'hidden';

  // Opacity: 0 when hidden, entering, or exiting; 0.92 when visible
  const opacity = (isHidden || isEntering || isExiting) ? 0 : 0.92;
  // Scale transform without bounce
  const baseScale = isEntering ? 'scale(0.92)' : isExiting ? 'scale(0.95)' : 'scale(1)';
  const transition = isExiting
    ? 'opacity 300ms ease-in, transform 300ms ease-in'
    : 'opacity 120ms ease-out, transform 120ms ease-out';

  const iconVolume = payload.volume ?? 1.0;
  const iconMuted = payload.isMuted ?? false;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) ${baseScale}`,
        opacity,
        visibility: isHidden ? 'hidden' : 'visible',
        transition,
        pointerEvents: 'none',
        zIndex: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        boxShadow: 'none',
        color: 'rgba(255, 255, 255, 0.92)',
        filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6))',
        userSelect: 'none'
      }}
    >
      {/* 64px Icon without scale pulse */}
      <div
        style={{
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'none'
        }}
      >
        {payload.type === 'play' && (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon
              points="6 4 20 12 6 20 6 4"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(255, 255, 255, 0.92)"
            />
          </svg>
        )}

        {payload.type === 'pause' && (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line
              x1="7"
              y1="5"
              x2="7"
              y2="19"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="17"
              y1="5"
              x2="17"
              y2="19"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {payload.type === 'mute' && (
          <VolumeIcon volume={0} isMuted={true} size={64} style={{ color: 'rgba(255, 255, 255, 0.92)' }} />
        )}

        {payload.type === 'unmute' && (
          <VolumeIcon volume={iconVolume} isMuted={false} size={64} style={{ color: 'rgba(255, 255, 255, 0.92)' }} isAnimating={true} />
        )}

        {payload.type === 'volume' && (
          <VolumeIcon volume={iconVolume} isMuted={iconMuted} size={64} style={{ color: 'rgba(255, 255, 255, 0.92)' }} isAnimating={true} />
        )}
      </div>

      {/* Percentage / Text: 14px semibold, tabular numbers */}
      {payload.text && (
        <span
          style={{
            marginTop: '8px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.92)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          }}
        >
          {payload.text}
        </span>
      )}
    </div>
  );
});

CenterPopup.displayName = 'CenterPopup';
