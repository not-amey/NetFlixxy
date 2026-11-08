import { useRef, useState, useCallback, useEffect } from 'react';

export type FlashType = 'play' | 'pause' | 'mute' | 'unmute' | 'volume';

export interface CenterFlashState {
  type: FlashType;
  text?: string;
  volume?: number;
  isMuted?: boolean;
  id: number;
}

export interface SkipBadgeData {
  appliedDelta: number;
  destination: number;
  duration: number;
  direction: 'forward' | 'back';
  pressCount: number;
}

export interface SeekIndicatorState {
  destination: number;
  duration: number;
  delta: number; // accumulated signed seconds
  id: number;
}

export function formatMediaTime(seconds: number, forceHours = false): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalSecs = Math.floor(seconds);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0 || forceHours) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatSkipDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '−';
  const abs = Math.abs(delta);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  if (m > 0) {
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${sign}0:${s.toString().padStart(2, '0')}`;
}

interface UseMediaPlayerOptions {
  initialVolume?: number;
  isPlayerActive?: boolean;
  onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  onEndedCallback?: () => void;
  onSeekCallback?: (targetSec: number, fromSkipDelta?: number) => void;
  onFlashCallback?: (payload: { type: FlashType; text?: string; volume?: number; isMuted?: boolean }) => void;
  onVolumeChangeCallback?: (volume: number, isMuted: boolean) => void;
}

export function useMediaPlayer(options: UseMediaPlayerOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const initVol = options.initialVolume !== undefined && options.initialVolume !== null
    ? Math.max(0, Math.min(1.0, options.initialVolume))
    : 1.0;

  const [volume, setVolume] = useState<number>(initVol);
  const currentVolumeRef = useRef<number>(initVol);
  const lastNonZeroVolumeRef = useRef<number>(initVol > 0 ? initVol : 0.5);

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const previousVolumeRef = useRef<number>(initVol);
  const [isBuffering, setIsBuffering] = useState(false);

  // Center flash icon state
  const [centerFlash, setCenterFlash] = useState<CenterFlashState | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Volume meter animation trigger
  const [volumeMeterActive, setVolumeMeterActive] = useState(false);
  const volumeMeterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Top-left Skip Badge state
  const [skipBadge, setSkipBadge] = useState<SkipBadgeData | null>(null);
  const skipBadgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Legacy seek indicator for compatibility
  const [seekIndicator, setSeekIndicator] = useState<SeekIndicatorState | null>(null);

  // Trigger Center Flash Icon
  const triggerFlash = useCallback((type: FlashType, text?: string, vol?: number, muted?: boolean) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const id = Date.now();
    const effectiveVol = vol !== undefined && vol !== null ? vol : currentVolumeRef.current;
    const effectiveMuted = muted !== undefined && muted !== null ? muted : isMutedRef.current;
    setCenterFlash({ type, text, volume: effectiveVol, isMuted: effectiveMuted, id });
    if (options.onFlashCallback) {
      options.onFlashCallback({ type, text, volume: effectiveVol, isMuted: effectiveMuted });
    }
    flashTimerRef.current = setTimeout(() => {
      setCenterFlash(null);
    }, 700);
  }, [options]);

  // Animate volume meter bars briefly
  const triggerVolumeMeterAnimation = useCallback(() => {
    setVolumeMeterActive(true);
    if (volumeMeterTimerRef.current) clearTimeout(volumeMeterTimerRef.current);
    volumeMeterTimerRef.current = setTimeout(() => {
      setVolumeMeterActive(false);
    }, 600);
  }, []);

  // Play / Pause
  const play = useCallback(() => {
    if (options.isPlayerActive === false && !videoRef.current) return;
    if (!videoRef.current) return;
    videoRef.current.play().then(() => {
      setIsPlaying(true);
      triggerFlash('play');
    }).catch(() => {});
  }, [options.isPlayerActive, triggerFlash]);

  const pause = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    triggerFlash('pause');
  }, [triggerFlash]);

  const togglePlay = useCallback(() => {
    if (options.isPlayerActive === false) return;
    if (!videoRef.current) return;
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [options.isPlayerActive, isPlaying, play, pause]);

  // Volume Control (0% to 100%)
  const setVolumeLevel = useCallback((val: number, showFlash = true) => {
    const clamped = Math.max(0, Math.min(1.0, Math.round(val * 100) / 100));
    currentVolumeRef.current = clamped;
    if (clamped > 0) {
      lastNonZeroVolumeRef.current = clamped;
    }
    setVolume(clamped);
    previousVolumeRef.current = clamped;
    if (isMutedRef.current) {
      isMutedRef.current = false;
      setIsMuted(false);
      if (videoRef.current) videoRef.current.muted = false;
    }
    if (videoRef.current) {
      videoRef.current.volume = clamped;
    }
    triggerVolumeMeterAnimation();
    if (showFlash) {
      const pct = Math.round(clamped * 100);
      triggerFlash('volume', `${pct}%`, clamped, false);
    }
    if (options.onVolumeChangeCallback) {
      options.onVolumeChangeCallback(clamped, false);
    }
  }, [triggerFlash, triggerVolumeMeterAnimation, options]);

  const changeVolume = useCallback((delta: number) => {
    const base = isMutedRef.current ? 0 : currentVolumeRef.current;
    const next = Math.max(0, Math.min(1.0, Math.round((base + delta) * 100) / 100));
    setVolumeLevel(next, true);
  }, [setVolumeLevel]);

  // Mute Toggle (restores previous volume, doesn't overwrite saved level)
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    if (isMutedRef.current) {
      // Unmute: restore previous level, or if 0% restore last nonzero level, or 50%
      let restore = previousVolumeRef.current;
      if (restore <= 0) {
        restore = lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 0.5;
      }
      isMutedRef.current = false;
      currentVolumeRef.current = restore;
      setIsMuted(false);
      videoRef.current.muted = false;
      videoRef.current.volume = restore;
      setVolume(restore);
      const pct = Math.round(restore * 100);
      triggerFlash('unmute', `${pct}%`, restore, false);
      triggerVolumeMeterAnimation();
      if (options.onVolumeChangeCallback) {
        options.onVolumeChangeCallback(restore, false);
      }
    } else {
      // Mute: keep previous volume intact
      previousVolumeRef.current = currentVolumeRef.current;
      isMutedRef.current = true;
      setIsMuted(true);
      videoRef.current.muted = true;
      triggerFlash('mute', 'Muted', currentVolumeRef.current, true);
      if (options.onVolumeChangeCallback) {
        options.onVolumeChangeCallback(currentVolumeRef.current, true);
      }
    }
  }, [triggerFlash, triggerVolumeMeterAnimation, options]);

  // Single source of truth for seeking and skip accumulation
  const pendingTargetRef = useRef<number | null>(null);
  const accumulatedSkipDeltaRef = useRef<number>(0);

  // Skip Functionality: Exactly 5s delta from the pending target time, single source of truth for seek and badge
  const skip = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;

    const dur = duration > 0 ? duration : (video.duration && isFinite(video.duration) ? video.duration : 999999);
    // Use the last requested pending target, not video.currentTime (which is stale during pending seeks)
    const currentBase = pendingTargetRef.current !== null ? pendingTargetRef.current : video.currentTime;
    const target = Math.max(0, Math.min(dur, currentBase + delta));
    const actuallyApplied = target - currentBase;

    pendingTargetRef.current = target;
    video.currentTime = target;
    setCurrentTime(target);

    // The badge amount and the seek amount come from the exact same value
    if (skipBadgeTimerRef.current) {
      clearTimeout(skipBadgeTimerRef.current);
      accumulatedSkipDeltaRef.current += actuallyApplied;
    } else {
      accumulatedSkipDeltaRef.current = actuallyApplied;
    }

    const totalDelta = accumulatedSkipDeltaRef.current;
    setSkipBadge((prev) => ({
      appliedDelta: Math.round(totalDelta),
      destination: target,
      duration: dur,
      direction: delta >= 0 ? 'forward' : 'back',
      pressCount: prev ? prev.pressCount + 1 : 1
    }));

    skipBadgeTimerRef.current = setTimeout(() => {
      setSkipBadge(null);
      accumulatedSkipDeltaRef.current = 0;
    }, 700);

    if (options.onSeekCallback) {
      options.onSeekCallback(target, delta);
    }
  }, [duration, options]);

  // Direct Seek Functionality (seek bar click/drag)
  const seekTo = useCallback((targetSec: number, fromSkipDelta?: number) => {
    if (fromSkipDelta !== undefined) {
      skip(fromSkipDelta);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const dur = duration > 0 ? duration : (video.duration && isFinite(video.duration) ? video.duration : 999999);
    const clamped = Math.max(0, Math.min(dur, targetSec));

    pendingTargetRef.current = clamped;
    video.currentTime = clamped;
    setCurrentTime(clamped);

    if (options.onSeekCallback) {
      options.onSeekCallback(clamped);
    }
  }, [duration, options, skip]);

  // Video element event listeners
  const handleSeeking = useCallback(() => setIsBuffering(true), []);
  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handleSeeked = useCallback(() => {
    setIsBuffering(false);
    if (videoRef.current) {
      pendingTargetRef.current = videoRef.current.currentTime;
    } else {
      pendingTargetRef.current = null;
    }
  }, []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);
  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setIsPlaying(true);
  }, []);
  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    if (!videoRef.current.seeking) {
      pendingTargetRef.current = cur;
    }
    const vDur = videoRef.current.duration;
    const dur = duration > 0 ? duration : (vDur && isFinite(vDur) ? vDur : 0);
    if (options.onTimeUpdateCallback) {
      options.onTimeUpdateCallback(cur, dur);
    } else {
      setCurrentTime(cur);
    }
  }, [duration, options]);

  const handleEnded = useCallback(() => {
    if (options.onEndedCallback) {
      options.onEndedCallback();
    }
  }, [options]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (volumeMeterTimerRef.current) clearTimeout(volumeMeterTimerRef.current);
      if (skipBadgeTimerRef.current) clearTimeout(skipBadgeTimerRef.current);
    };
  }, []);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    setDuration,
    setCurrentTime,
    volume,
    isMuted,
    isBuffering,
    centerFlash,
    volumeMeterActive,
    skipBadge,
    setSkipBadge,
    seekIndicator,
    play,
    pause,
    togglePlay,
    setVolumeLevel,
    changeVolume,
    toggleMute,
    seekTo,
    skip,
    triggerFlash,
    handleSeeking,
    handleWaiting,
    handleSeeked,
    handleCanPlay,
    handlePlaying,
    handlePause,
    handleTimeUpdate,
    handleEnded
  };
}
