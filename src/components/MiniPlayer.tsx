import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  X,
  Volume2,
  VolumeX
} from 'lucide-react';
import Hls from 'hls.js';
import { SkipBadge } from './SkipBadge';
import { useMediaPlayer, formatMediaTime, formatSkipDelta } from '../hooks/useMediaPlayer';
import { VolumeIcon } from './VolumeIcon';
import { CenterPopup, CenterPopupRef } from './CenterPopup';

interface MiniInitData {
  filePath: string;
  currentTime: number;
  isPlaying: boolean;
  item?: any;
  episode?: any;
}

export const MiniPlayer: React.FC = () => {
  const [initData, setInitData] = useState<MiniInitData | null>(null);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const miniPopupRef = useRef<CenterPopupRef>(null);

  const handleMiniSeek = useCallback((targetSec: number) => {
    // A seek only changes currentTime on the existing video element. Never change src or restart ffmpeg.
    if (videoRef.current) {
      videoRef.current.currentTime = targetSec;
    }
  }, []);

  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    setDuration,
    setCurrentTime,
    volume,
    isMuted,
    centerFlash,
    volumeMeterActive,
    skipBadge,
    play,
    pause,
    togglePlay,
    setVolumeLevel,
    changeVolume,
    toggleMute,
    seekTo,
    skip,
    handleSeeking,
    handleWaiting,
    handleSeeked,
    handleCanPlay,
    handlePlaying: originalHandlePlaying,
    handlePause: originalHandlePause,
    handleTimeUpdate: hookTimeUpdate,
    handleEnded
  } = useMediaPlayer({
    initialVolume: 1.0,
    onFlashCallback: (flash) => {
      miniPopupRef.current?.trigger(flash);
    },
    onVolumeChangeCallback: (vol, muted) => {
      (window as any).electronAPI?.syncVolume?.({ volume: vol, isMuted: muted });
    },
    onEndedCallback: () => {
      handleClose();
    },
    onSeekCallback: (targetSec) => {
      handleMiniSeek(targetSec);
    },
    onTimeUpdateCallback: (cur, dur) => {
      setCurrentTime(cur);
    }
  });

  // Sync volume with electron store and other windows
  useEffect(() => {
    (window as any).electronAPI?.getSettings?.().then((sets: any) => {
      if (sets && typeof sets.volume === 'number') {
        setVolumeLevel(sets.volume, false);
      }
    });
    const unsub = (window as any).electronAPI?.onVolumeUpdate?.((data: any) => {
      if (data && typeof data.volume === 'number') {
        setVolumeLevel(data.volume, false);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handlePlaying = useCallback(() => {
    originalHandlePlaying();
    (window as any).electronAPI?.notifyPlaybackStatus?.('playing');
  }, [originalHandlePlaying]);

  const handlePause = useCallback(() => {
    originalHandlePause();
    (window as any).electronAPI?.notifyPlaybackStatus?.('paused');
  }, [originalHandlePause]);

  // Load init data from Electron main process
  useEffect(() => {
    (window as any).electronAPI?.getMiniInitData().then((data: MiniInitData) => {
      if (!data) return;
      setInitData(data);
      if (data.currentTime) {
        setCurrentTime(data.currentTime);
      }
    });
  }, [setCurrentTime]);

  // Stream initialization: Direct Range 206 for native formats, HLS with hls.js for MKV/HEVC/AC3/DTS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !initData?.filePath) return;

    (window as any).electronAPI?.notifyPlaybackStatus?.('loading');

    let destroyed = false;
    const resume = initData.currentTime || 0;

    (window as any).electronAPI
      ?.getMediaInfo(initData.filePath)
      .then((details: any) => {
        if (destroyed || !details) return;
        setMediaDetails(details);
        if (details.duration > 0) {
          setDuration(details.duration);
        }

        const ext = (details.ext || '').toLowerCase();
        const vCodec = (details.vCodec || '').toLowerCase();
        const aCodec = (details.aCodec || '').toLowerCase();
        const nativeContainers = ['.mp4', '.webm', '.m4v', '.mov'];
        const nativeVideoCodecs = ['h264', 'avc', 'avc1', 'vp8', 'vp9', 'av1', 'av01'];
        const nativeAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'wav', 'pcm_s16le', 'pcm_s24le', ''];

        const isDirectNative =
          nativeContainers.includes(ext) &&
          nativeVideoCodecs.includes(vCodec) &&
          nativeAudioCodecs.includes(aCodec);

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (isDirectNative) {
          const directUrl = `http://127.0.0.1:39281/stream?file=${encodeURIComponent(initData.filePath)}`;
          video.src = directUrl;
          if (resume > 0) video.currentTime = resume;
          if (initData.isPlaying) video.play().catch(() => {});
        } else if (Hls.isSupported()) {
          if (video.src) {
            video.removeAttribute('src');
            video.load();
          }
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 10,
            maxBufferLength: 8,
            maxMaxBufferLength: 16,
            startPosition: resume > 0 ? resume : 0,
            maxBufferHole: 0.1,
            highBufferWatchdogPeriod: 1,
            nudgeMaxRetry: 5
          });
          hlsRef.current = hls;

          const hlsUrl = (window as any).electronAPI.getHlsUrl(initData.filePath, 0, 'mini');
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (destroyed) return;
            if (initData.isPlaying) video.play().catch(() => {});
          });

          hls.once(Hls.Events.FRAG_BUFFERED, () => {
            if (destroyed) return;
            if (initData.isPlaying) video.play().catch(() => {});
          });
        }
      })
      .catch((err: any) => {
        console.warn('[MiniPlayer] Error probing media info:', err);
      });

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initData?.filePath]);

  // Sync initial playback position once video is ready
  const handleLoadedMetadata = () => {
    if (videoRef.current && initData) {
      if (initData.isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  };

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    let lastX = -1;
    let lastY = -1;
    const onMove = (e: MouseEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      resetControlsTimeout();
    };
    const onDown = () => resetControlsTimeout();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    resetControlsTimeout();
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetControlsTimeout]);

  // Expand back to full main player
  const handleExpand = useCallback(() => {
    const cur = videoRef.current?.currentTime ?? currentTime;
    const isCurrentlyPlaying = videoRef.current ? !videoRef.current.paused : isPlaying;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;
    }
    (window as any).electronAPI?.closeMiniPlayer({
      currentTime: cur,
      isPlaying: isCurrentlyPlaying,
      expand: true,
      closePlayback: false
    });
  }, [currentTime, isPlaying, videoRef]);

  // Close mini player and stop playback
  const handleClose = useCallback(() => {
    (window as any).electronAPI?.notifyPlaybackStatus?.('stopped');
    const cur = videoRef.current?.currentTime ?? currentTime;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;
    }
    (window as any).electronAPI?.closeMiniPlayer({
      currentTime: cur,
      isPlaying: false,
      expand: false,
      closePlayback: true
    });
  }, [currentTime, videoRef]);

  // Handle requestClose from global shortcut Ctrl+M or Right Alt release
  useEffect(() => {
    const unsub = (window as any).electronAPI?.onRequestCloseMini?.(() => {
      handleExpand();
    });
    return () => {
      if (unsub) unsub();
    };
  }, [handleExpand]);

  // Keyboard shortcuts in mini player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyM') {
        e.preventDefault();
        handleExpand();
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          skip(-5);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          skip(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.05); // Arrow keys stay at 5 points
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.05); // Arrow keys stay at 5 points
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, togglePlay, seekTo, changeVolume, toggleMute, handleClose, handleExpand]);

  // Mouse wheel volume control in mini player: 1% per notch
  useEffect(() => {
    let wheelAccumulator = 0;
    let wheelTimer: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      resetControlsTimeout();

      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelAccumulator = 0;
      }, 300);

      const deltaY = e.deltaY;
      const TRACKPAD_STEP = 50;

      if (Math.abs(deltaY) >= 50) {
        // Discrete mouse wheel notch: exactly 1 point (0.01) per notch
        wheelAccumulator = 0;
        const steps = Math.max(1, Math.round(Math.abs(deltaY) / 100));
        const direction = deltaY < 0 ? 0.01 : -0.01;
        changeVolume(direction * steps);
      } else {
        // Trackpad sends many small wheel events: accumulate and step 1 point per notch's worth
        if (Math.sign(deltaY) !== Math.sign(wheelAccumulator)) {
          wheelAccumulator = 0;
        }
        wheelAccumulator += deltaY;
        if (Math.abs(wheelAccumulator) >= TRACKPAD_STEP) {
          const steps = Math.floor(Math.abs(wheelAccumulator) / TRACKPAD_STEP);
          const direction = wheelAccumulator < 0 ? 0.01 : -0.01;
          wheelAccumulator -= Math.sign(wheelAccumulator) * steps * TRACKPAD_STEP;
          changeVolume(direction * steps);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [changeVolume, resetControlsTimeout]);

  const currentFilePath = initData?.filePath || '';
  const displayTitle = initData?.episode
    ? `${initData.item?.title || ''} S${initData.episode.season}:E${initData.episode.episode}`
    : initData?.item?.title || currentFilePath.split(/[\\/]/).pop() || 'Playing';

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
      onMouseEnter={resetControlsTimeout}
    >
      {/* Draggable video area (native OS window dragging) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          WebkitAppRegion: 'drag' as any,
          zIndex: 10
        }}
        onDoubleClick={handleExpand}
      />

      {/* Resize handles along window edges: no-drag so OS resize cursors and handles work */}
      <div style={{ position: 'absolute', top: 0, left: '6px', right: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', bottom: 0, left: '6px', right: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', top: '6px', bottom: '6px', left: 0, width: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', top: '6px', bottom: '6px', right: 0, width: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '6px', height: '6px', zIndex: 150, WebkitAppRegion: 'no-drag' as any }} />

      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        onTimeUpdate={hookTimeUpdate}
        onSeeking={handleSeeking}
        onWaiting={handleWaiting}
        onSeeked={handleSeeked}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000'
        }}
      />

      {/* Center Popup (One mounted element, 64px, 120ms in, 600ms hold, 300ms out, 80ms pulse) */}
      <CenterPopup ref={miniPopupRef} />

      {/* Skip Badge (Top-Left 24px) */}
      <SkipBadge data={skipBadge} />

      {/* Top Floating Bar: Filename, S/M/L buttons, Expand, Close */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '8px 12px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.25s ease',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        {/* Filename / Title */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#fff',
            maxWidth: '45%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            pointerEvents: 'none'
          }}
          title={displayTitle}
        >
          {displayTitle}
        </span>

        {/* Action Controls in Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: showControls ? 'auto' : 'none',
            WebkitAppRegion: 'no-drag' as any
          }}
        >
          {/* Expand to Main Window button */}
          <button
            onClick={handleExpand}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              pointerEvents: showControls ? 'auto' : 'none',
              WebkitAppRegion: 'no-drag' as any
            }}
            title="Expand to Full Player"
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e50914')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <Maximize2 size={13} />
          </button>

          {/* Close mini player */}
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              pointerEvents: showControls ? 'auto' : 'none',
              WebkitAppRegion: 'no-drag' as any
            }}
            title="Close Mini Player (Ctrl+M)"
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e50914')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Center Controls on Hover: Skip Back 5s, Play/Pause, Skip Forward 5s */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.25s ease',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        <button
          onClick={() => skip(-5)}
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s, transform 0.1s',
            pointerEvents: showControls ? 'auto' : 'none',
            WebkitAppRegion: 'no-drag' as any
          }}
          title="Rewind 5s (Left Arrow)"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e50914')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={togglePlay}
          style={{
            background: '#e50914',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(229, 9, 20, 0.5)',
            transition: 'transform 0.1s',
            pointerEvents: showControls ? 'auto' : 'none',
            WebkitAppRegion: 'no-drag' as any
          }}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" style={{ marginLeft: '2px' }} />}
        </button>

        <button
          onClick={() => skip(5)}
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s, transform 0.1s',
            pointerEvents: showControls ? 'auto' : 'none',
            WebkitAppRegion: 'no-drag' as any
          }}
          title="Forward 5s (Right Arrow)"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e50914')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* Bottom Floating Bar: Time, Volume, Mute */}
      <div
        style={{
          position: 'absolute',
          bottom: '5px',
          left: 0,
          right: 0,
          padding: '4px 10px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.25s ease',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        <span style={{ fontSize: '11px', color: '#ccc', fontWeight: 600, pointerEvents: 'none' }}>
          {formatMediaTime(currentTime, duration >= 3600)} / {formatMediaTime(duration, duration >= 3600)}
        </span>

        <button
          onClick={toggleMute}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            pointerEvents: showControls ? 'auto' : 'none',
            WebkitAppRegion: 'no-drag' as any
          }}
          title="Mute / Unmute (M)"
        >
          <VolumeIcon volume={volume} isMuted={isMuted} size={16} isAnimating={volumeMeterActive} />
        </button>
      </div>

      {/* Thin bottom progress line (always visible) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          zIndex: 120,
          WebkitAppRegion: 'no-drag' as any
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: '#e50914',
            transition: 'width 0.15s linear'
          }}
        />
      </div>
    </div>
  );
};
