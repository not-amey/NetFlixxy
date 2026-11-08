import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  ArrowLeft,
  FastForward,
  SkipForward,
  Captions,
  ListVideo,
  X,
  Check,
  Clock,
  Sparkles,
  RotateCcw,
  RotateCw,
  PictureInPicture,
  Volume2
} from 'lucide-react';
import Hls from 'hls.js';
import logoPng from '../assets/logo.png';
import { SkipBadge } from './SkipBadge';
import { VolumeIcon } from './VolumeIcon';
import { CenterPopup, CenterPopupRef } from './CenterPopup';
import { useMediaPlayer, formatMediaTime, formatSkipDelta } from '../hooks/useMediaPlayer';
import { MediaItem, SeriesItem, EpisodeItem, WatchProgress } from '../types/media';

interface MemoizedEpisodeListProps {
  episodes: EpisodeItem[];
  currentEpisodeId?: string | null;
  currentEpisode?: EpisodeItem | null;
  progressMap: Record<string, WatchProgress>;
  onSelectEpisode?: (episode: EpisodeItem) => void;
  onCloseDrawer: () => void;
}

const MemoizedEpisodeList = React.memo<MemoizedEpisodeListProps>(({
  episodes,
  currentEpisodeId,
  currentEpisode,
  progressMap,
  onSelectEpisode,
  onCloseDrawer
}) => {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {episodes.map((ep) => {
        const isCurrent = Boolean(
          ep && currentEpisode && (
            (ep.filePath && currentEpisode.filePath && ep.filePath.toLowerCase() === currentEpisode.filePath.toLowerCase()) ||
            (ep.id && currentEpisode.id && String(ep.id) === String(currentEpisode.id)) ||
            (ep.season != null && ep.episode != null && currentEpisode.season != null && currentEpisode.episode != null &&
             Number(ep.season) === Number(currentEpisode.season) && Number(ep.episode) === Number(currentEpisode.episode))
          )
        );
        const epThumb = (window as any).electronAPI?.getThumbUrl(ep.thumbnail || ep.filePath);
        const epDur = (ep.duration && ep.duration > 0)
          ? ep.duration
          : (progressMap[ep.filePath]?.duration || 0);

        const epDurationStr = epDur > 0
          ? (epDur >= 3600
              ? `${Math.floor(epDur / 3600)}h ${Math.round((epDur % 3600) / 60)}m`
              : `${Math.round(epDur / 60)}m`)
          : null;

        return (
          <div
            key={ep.filePath || `${ep.season}-${ep.episode}` || ep.id}
            onClick={() => {
              if (onSelectEpisode) {
                onSelectEpisode(ep);
                onCloseDrawer();
              }
            }}
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px',
              borderRadius: '8px',
              background: isCurrent ? 'rgba(229, 9, 20, 0.18)' : '#000000',
              border: isCurrent ? '1px solid #e50914' : '1px solid #1a1a1a',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isCurrent ? 'rgba(229, 9, 20, 0.28)' : '#141414';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isCurrent ? 'rgba(229, 9, 20, 0.18)' : '#000000';
            }}
          >
            <div
              style={{
                width: '120px',
                aspectRatio: '16/9',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: '#111',
                position: 'relative',
                flexShrink: 0
              }}
            >
              <img
                src={epThumb}
                alt={ep.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.35)'
                }}
              >
                <Play size={18} fill="#fff" />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  {ep.episode}. {ep.title}
                </span>
                {epDurationStr && (
                  <span style={{ fontSize: '12px', color: isCurrent ? '#ffffff' : '#888', fontWeight: 500, flexShrink: 0, marginLeft: '8px' }}>
                    {epDurationStr}
                  </span>
                )}
              </div>
              {ep.overview && (
                <p
                  style={{
                    fontSize: '12px',
                    color: isCurrent ? 'rgba(255, 255, 255, 0.92)' : '#777',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    margin: 0
                  }}
                >
                  {ep.overview}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export interface AudioTrackInfo {
  index: number;
  audioIndex: number;
  codec: string;
  channels: number;
  layout: string;
  language: string;
  title: string;
  label: string;
}

export interface SubtitleTrackInfo {
  id: string;
  type: 'embedded' | 'external';
  streamIndex?: number;
  subIndex?: number;
  codec?: string;
  language?: string;
  title?: string;
  label: string;
  url: string;
}

export interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export function parseVttCues(vttContent: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  if (!vttContent) return cues;
  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let i = 0;
  // Skip WEBVTT header and comment/style blocks before first cue
  while (i < lines.length) {
    if (lines[i].includes('-->')) break;
    i++;
  }

  const timeRegex = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/;

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(timeRegex);
    if (match) {
      const h1 = match[1] ? parseInt(match[1], 10) : 0;
      const m1 = parseInt(match[2], 10);
      const s1 = parseInt(match[3], 10);
      const ms1 = parseInt(match[4], 10);
      const start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000;

      const h2 = match[5] ? parseInt(match[5], 10) : 0;
      const m2 = parseInt(match[6], 10);
      const s2 = parseInt(match[7], 10);
      const ms2 = parseInt(match[8], 10);
      const end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000;

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        const cleanLine = lines[i].replace(/<[^>]+>/g, '').trim();
        if (cleanLine) {
          textLines.push(cleanLine);
        }
        i++;
      }
      const rawText = textLines.join('\n').trim();
      if (rawText) {
        cues.push({ startTime: start, endTime: end, text: rawText });
      }
    } else {
      i++;
    }
  }

  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

export function findActiveCue(
  cues: SubtitleCue[],
  currentTime: number,
  subDelay: number
): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;
  // Apply saved delay once here: cue matches if start <= (currentTime - subDelay) < end
  const targetTime = currentTime - subDelay;
  if (targetTime < 0) return null;

  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (cue.startTime <= targetTime && targetTime < cue.endTime) {
      let startIdx = mid;
      while (startIdx > 0 && cues[startIdx - 1].startTime <= targetTime && targetTime < cues[startIdx - 1].endTime) {
        startIdx--;
      }
      let endIdx = mid;
      while (endIdx < cues.length - 1 && cues[endIdx + 1].startTime <= targetTime && targetTime < cues[endIdx + 1].endTime) {
        endIdx++;
      }
      if (startIdx === endIdx) {
        return cue;
      }
      const combinedText = cues.slice(startIdx, endIdx + 1).map((c) => c.text).join('\n');
      return {
        startTime: cues[startIdx].startTime,
        endTime: Math.max(...cues.slice(startIdx, endIdx + 1).map((c) => c.endTime)),
        text: combinedText
      };
    }
    if (targetTime < cue.startTime) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return null;
}

interface PlayerProps {
  item: MediaItem;
  episode?: EpisodeItem | null;
  progress?: WatchProgress | null;
  progressMap?: Record<string, WatchProgress>;
  onClose: () => void;
  onUpdateProgress: (filePath: string, current: number, total: number) => void;
  onNextEpisode?: () => void;
  onSelectEpisode?: (episode: EpisodeItem) => void;
  hasNextEpisode?: boolean;
  onOpenMiniPlayer?: (currentTime: number, isPlaying: boolean) => void;
  isSettingsOpen?: boolean;
}

export const Player: React.FC<PlayerProps> = ({
  item,
  episode,
  progress,
  progressMap = {},
  onClose,
  onUpdateProgress,
  onNextEpisode,
  onSelectEpisode,
  hasNextEpisode,
  onOpenMiniPlayer,
  isSettingsOpen = false
}) => {
  const currentFilePath = episode ? episode.filePath : (item as any).filePath;
  const isSeries = item.type === 'series';
  const autoPlayedRef = useRef(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  // Reset autoPlay flag and countdown when switching episode/file
  useEffect(() => {
    autoPlayedRef.current = false;
    setNextCountdown(null);
  }, [currentFilePath]);

  const [activePlayer, setActivePlayer] = useState<'main' | 'mini'>('main');
  const activePlayerRef = useRef<'main' | 'mini'>('main');
  activePlayerRef.current = activePlayer;

  const initialResume = progress && progress.currentTime > 5 && !progress.completed ? progress.currentTime : 0;
  const [streamStartOffset, setStreamStartOffset] = useState<number>(initialResume);
  const streamStartOffsetRef = useRef<number>(initialResume);
  streamStartOffsetRef.current = streamStartOffset;
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number>(0);
  const selectedAudioIndexRef = useRef<number>(0);
  selectedAudioIndexRef.current = selectedAudioIndex;

  const [mediaDetails, setMediaDetails] = useState<{
    duration: number;
    isDirectPlayable: boolean;
    vCodec: string;
    aCodec: string;
    audioTracks?: AudioTrackInfo[];
    subtitleTracks?: SubtitleTrackInfo[];
  } | null>(null);
  const mediaDetailsRef = useRef<any>(null);
  mediaDetailsRef.current = mediaDetails;

  const progressFillRef = useRef<HTMLDivElement>(null);
  const scrubberThumbRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastSavedSecRef = useRef<number>(-1);
  const hlsRef = useRef<Hls | null>(null);

  const updateProgressDOM = useCallback((cur: number, dur: number) => {
    const pct = dur > 0 ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`;
    }
    if (scrubberThumbRef.current) {
      scrubberThumbRef.current.style.left = `${pct}%`;
    }
    if (timeLabelRef.current) {
      timeLabelRef.current.textContent = `${formatMediaTime(cur, dur >= 3600)} / ${formatMediaTime(dur, dur >= 3600)}`;
    }
  }, []);


  const centerPopupRef = useRef<CenterPopupRef>(null);

  const [subDelay, setSubDelay] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`subDelay_${currentFilePath}`);
      if (saved !== null) {
        return parseFloat(saved) || 0;
      }
    } catch {}
    return (progress as any)?.subDelay ?? 0;
  });
  const subDelayRef = useRef<number>(subDelay);
  subDelayRef.current = subDelay;

  // Custom subtitle cues state (sorted cues, binary search lookup, delay applied once)
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [cuesLoaded, setCuesLoaded] = useState<boolean>(false);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const cuesRef = useRef<SubtitleCue[]>([]);
  cuesRef.current = cues;
  const activeCueRef = useRef<SubtitleCue | null>(null);

  const updateCueAtTime = useCallback((time: number) => {
    if (!cuesLoaded || cuesRef.current.length === 0) {
      if (activeCueRef.current !== null) {
        activeCueRef.current = null;
        setActiveCue(null);
      }
      return;
    }
    const cue = findActiveCue(cuesRef.current, time, subDelayRef.current);
    if (cue !== activeCueRef.current) {
      activeCueRef.current = cue;
      setActiveCue(cue);
    }
  }, [cuesLoaded]);

  const [delayPillText, setDelayPillText] = useState<string | null>(null);
  const delayPillTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showDelayPill = useCallback((val: number) => {
    if (delayPillTimerRef.current) clearTimeout(delayPillTimerRef.current);
    const sign = val > 0 ? '+' : '';
    setDelayPillText(`Subtitle Delay: ${sign}${val.toFixed(1)} s`);
    delayPillTimerRef.current = setTimeout(() => {
      setDelayPillText(null);
    }, 1800);
  }, []);

  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  // Controls auto-hide (3 seconds after last mouse movement, key press, or click, whether playing or paused)
  const resetControlsTimeout = useCallback(() => {
    if (isSettingsOpen) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      return;
    }
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showSettings && !showEpisodesDrawer && !isSettingsOpen) {
        setShowControls(false);
      }
    }, 3000);
  }, [showSettings, showEpisodesDrawer, isSettingsOpen]);

  const {
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
    handleEnded: hookEnded
  } = useMediaPlayer({
    initialVolume: 1.0,
    isPlayerActive: activePlayer === 'main',
    onFlashCallback: (flash) => {
      centerPopupRef.current?.trigger(flash);
    },
    onVolumeChangeCallback: (newVol, muted) => {
      (window as any).electronAPI?.syncVolume?.({ volume: newVol, isMuted: muted });
    },
    onTimeUpdateCallback: (cur, dur) => {
      if (activePlayerRef.current !== 'main') return;
      const actualDur = duration > 0 ? duration : (mediaDetailsRef.current?.duration || dur);

      // Update seek bar fill and time label directly through refs in requestAnimationFrame
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        updateProgressDOM(cur, actualDur);
      });

      // Periodic progress save to store every 5 seconds (not React state on every tick)
      const secFloor = Math.floor(cur);
      if (secFloor !== lastSavedSecRef.current && secFloor % 5 === 0 && actualDur > 0) {
        lastSavedSecRef.current = secFloor;
        onUpdateProgress(currentFilePath, cur, actualDur);
      }

      // Next Episode Countdown: ONLY for series with next episode, and ONLY in the last 5 seconds (5 to 1)
      if (isSeries && hasNextEpisode && actualDur > 5) {
        const remaining = actualDur - cur;
        if (remaining <= 5 && remaining > 0) {
          const sec = Math.max(1, Math.min(5, Math.ceil(remaining)));
          setNextCountdown(sec);
        } else if (remaining <= 0) {
          if (!autoPlayedRef.current) {
            autoPlayedRef.current = true;
            setNextCountdown(null);
            if (onNextEpisode) onNextEpisode();
          }
        } else {
          setNextCountdown(null);
          autoPlayedRef.current = false;
        }
      } else {
        setNextCountdown(null);
      }
    },
    onSeekCallback: (targetSec) => {
      // Seek ONLY changes currentTime on the existing video element. Never change src, remount, or restart ffmpeg.
      if (videoRef.current) {
        videoRef.current.currentTime = targetSec;
        const actualDur = duration > 0 ? duration : (mediaDetailsRef.current?.duration || 0);
        updateProgressDOM(targetSec, actualDur);
      }
    },
    onEndedCallback: () => {
      if (activePlayerRef.current !== 'main') return;
      const dur = duration || (videoRef.current?.duration && isFinite(videoRef.current.duration) ? videoRef.current.duration : 0);
      onUpdateProgress(currentFilePath, dur, dur);
      if (isSeries && hasNextEpisode && onNextEpisode && !autoPlayedRef.current) {
        autoPlayedRef.current = true;
        setNextCountdown(null);
        onNextEpisode();
      }
    }
  });

  const handlePlaying = useCallback(() => {
    originalHandlePlaying();
    (window as any).electronAPI?.notifyPlaybackStatus?.('playing');
  }, [originalHandlePlaying]);

  const handlePause = useCallback(() => {
    originalHandlePause();
    if (activePlayerRef.current === 'main') {
      setShowControls(true);
      resetControlsTimeout();
    }
    if (videoRef.current && currentFilePath) {
      const cur = videoRef.current.currentTime;
      const dur = duration > 0 ? duration : (mediaDetailsRef.current?.duration || videoRef.current.duration || 0);
      if (dur > 0 && cur > 0) {
        onUpdateProgress(currentFilePath, cur, dur);
      }
    }
    (window as any).electronAPI?.notifyPlaybackStatus?.('paused');
  }, [originalHandlePause, currentFilePath, duration, onUpdateProgress, resetControlsTimeout]);

  const handlePlayerClose = useCallback(() => {
    if (videoRef.current && currentFilePath) {
      const cur = videoRef.current.currentTime;
      const dur = duration > 0 ? duration : (mediaDetailsRef.current?.duration || videoRef.current.duration || 0);
      if (dur > 0 && cur > 0) {
        onUpdateProgress(currentFilePath, cur, dur);
      }
    }
    (window as any).electronAPI?.notifyPlaybackStatus?.('stopped');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    onClose();
  }, [currentFilePath, duration, onClose, onUpdateProgress]);

  const updateSubDelay = useCallback((newDelay: number) => {
    const rounded = Math.round(newDelay * 10) / 10;
    setSubDelay(rounded);
    subDelayRef.current = rounded;
    try {
      localStorage.setItem(`subDelay_${currentFilePath}`, rounded.toString());
    } catch {}
    if (videoRef.current && currentFilePath) {
      const cur = videoRef.current.currentTime;
      const dur = duration > 0 ? duration : (mediaDetailsRef.current?.duration || videoRef.current.duration || 0);
      onUpdateProgress(currentFilePath, cur, dur);
      updateCueAtTime(cur);
    }
    showDelayPill(rounded);
  }, [currentFilePath, duration, onUpdateProgress, showDelayPill, updateCueAtTime]);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const seekTrackRef = useRef<HTMLDivElement>(null);

  // Exact seek bar state
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);



  // Mini player handoff
  const handleOpenMiniPlayer = useCallback(() => {
    if (activePlayerRef.current === 'mini') return;

    const video = videoRef.current;
    const wasPlaying = isPlaying || (video ? !video.paused : false);
    const curTime = video ? video.currentTime : currentTime;

    // Immediately pause and mute main video so nothing makes sound while hidden
    if (video) {
      video.pause();
      video.muted = true;
    }
    pause();
    setActivePlayer('mini');
    activePlayerRef.current = 'mini';

    setShowControls(false);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    lastPointerPosRef.current = null;

    const payload = {
      filePath: currentFilePath,
      currentTime: curTime,
      isPlaying: wasPlaying,
      item,
      episode
    };
    if (onOpenMiniPlayer) {
      onOpenMiniPlayer(curTime, wasPlaying);
    } else if ((window as any).electronAPI?.openMiniPlayer) {
      (window as any).electronAPI.openMiniPlayer(payload);
    }
  }, [isPlaying, currentTime, pause, onOpenMiniPlayer, currentFilePath, item, episode]);

  // Mini player handoff: sync time and play state back to main player on close / expand
  useEffect(() => {
    const unsubResume = (window as any).electronAPI?.onMiniCloseResume((data: any) => {
      if (data?.closePlayback) {
        handlePlayerClose();
        return;
      }
      if (data && typeof data.currentTime === 'number') {
        setActivePlayer('main');
        activePlayerRef.current = 'main';

        setShowControls(false);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        lastPointerPosRef.current = null;

        const video = videoRef.current;
        if (video) {
          video.muted = false;
          video.currentTime = data.currentTime;
        }

        seekTo(data.currentTime);

        if (data.isPlaying) {
          if (video) {
            video.play().catch(() => {});
          }
          play();
        } else {
          pause();
        }
      }
    });

    const unsubGlobalToggle = (window as any).electronAPI?.onGlobalToggleMini(() => {
      handleOpenMiniPlayer();
    });

    return () => {
      if (unsubResume) unsubResume();
      if (unsubGlobalToggle) unsubGlobalToggle();
    };
  }, [seekTo, play, pause, handleOpenMiniPlayer, handlePlayerClose]);

  // Lock root document scroll while player is open, restore when closed
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    };
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals & Panels
  const [settingsTab, setSettingsTab] = useState<'audio' | 'subtitles' | 'quality'>('audio');

  // Subtitle custom state
  const [selectedSubId, setSelectedSubId] = useState<string>('off');
  const [subFontSize, setSubFontSize] = useState<number>(22);
  const [subColor, setSubColor] = useState<string>('#ffffff');

  // Quality & Playback options
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');

  const series = isSeries ? (item as SeriesItem) : null;
  const seasonsList = series ? Object.keys(series.seasons).map(Number).sort((a, b) => a - b) : [];
  const [drawerSeason, setDrawerSeason] = useState<number>(episode?.season || seasonsList[0] || 1);

  const epName = episode?.episodeTitle || (episode?.title && !episode.title.startsWith('Episode') ? episode.title : null);
  const currentTitle = episode
    ? `${item.title} • S${episode.season}:E${episode.episode}${epName ? ` "${epName}"` : ''}`
    : item.title;
  const currentResolution = episode?.resolution || (item as any).resolution || '1080P';

  const [videoError, setVideoError] = useState<string | null>(null);

  // Stream initialization: Direct Range 206 for native formats, HLS with hls.js for MKV/HEVC/AC3/DTS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentFilePath) return;

    (window as any).electronAPI?.notifyPlaybackStatus?.('loading');

    let destroyed = false;
    const resume = progress && progress.currentTime > 5 && !progress.completed ? progress.currentTime : 0;

    (window as any).electronAPI
      ?.getMediaInfo(currentFilePath)
      .then((details: any) => {
        if (destroyed || !details) return;
        setMediaDetails(details);
        if (details.duration > 0) {
          setDuration(details.duration);
        }
        // Subtitles off by default on every video load; turns on only when chosen from menu
        setSelectedSubId('off');

        const ext = (details.ext || '').toLowerCase();
        const vCodec = (details.vCodec || '').toLowerCase();
        const aCodec = (details.aCodec || '').toLowerCase();
        const nativeContainers = ['.mp4', '.webm', '.m4v', '.mov'];
        const nativeVideoCodecs = ['h264', 'avc', 'avc1', 'vp8', 'vp9', 'av1', 'av01'];
        const nativeAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'wav', 'pcm_s16le', 'pcm_s24le', ''];

        const isDirectNative =
          nativeContainers.includes(ext) &&
          nativeVideoCodecs.includes(vCodec) &&
          nativeAudioCodecs.includes(aCodec) &&
          selectedAudioIndex === 0;

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (isDirectNative) {
          const directUrl = `http://127.0.0.1:39281/stream?file=${encodeURIComponent(currentFilePath)}`;
          if (video.src !== directUrl) {
            video.src = directUrl;
          }
          if (resume > 0) {
            video.currentTime = resume;
          }
          video.play().catch(() => {});
        } else {
          // MKV, HEVC, AC3, DTS, or secondary audio: Use HLS with hls.js
          if (Hls.isSupported()) {
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

            const hlsUrl = (window as any).electronAPI.getHlsUrl(currentFilePath, selectedAudioIndex, 'main');
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (destroyed) return;
              video.play().catch(() => {});
            });

            hls.once(Hls.Events.FRAG_BUFFERED, () => {
              if (destroyed) return;
              video.play().catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                console.warn('[HLS Error]', data);
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = (window as any).electronAPI.getHlsUrl(currentFilePath, selectedAudioIndex, 'main');
            if (resume > 0) video.currentTime = resume;
            video.play().catch(() => {});
          }
        }
      })
      .catch((err: any) => {
        console.warn('Could not probe media info:', err);
      });

    if (episode) {
      setDrawerSeason(episode.season);
    }

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentFilePath, selectedAudioIndex, episode]);

  const isDirect = (mediaDetails?.isDirectPlayable ?? true) && selectedAudioIndex === 0;

  // Handle switching audio tracks dynamically
  const handleAudioChange = (newAudioIdx: number) => {
    if (newAudioIdx === selectedAudioIndex) return;
    setSelectedAudioIndex(newAudioIdx);
  };

  // Apply playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Load saved delay per video when currentFilePath changes
  useEffect(() => {
    if (!currentFilePath) return;
    try {
      const saved = localStorage.getItem(`subDelay_${currentFilePath}`);
      const val = saved !== null ? (parseFloat(saved) || 0) : ((progress as any)?.subDelay ?? 0);
      setSubDelay(val);
      subDelayRef.current = val;
    } catch {}
  }, [currentFilePath]);

  // When video changes, clear old cues immediately and don't show text until new ones load
  useEffect(() => {
    setCues([]);
    setCuesLoaded(false);
    setActiveCue(null);
    activeCueRef.current = null;
  }, [currentFilePath]);

  // Load and parse cues whenever selectedSubId or mediaDetails changes
  useEffect(() => {
    if (selectedSubId === 'off' || !mediaDetails?.subtitleTracks?.length) {
      setCues([]);
      setCuesLoaded(true);
      setActiveCue(null);
      activeCueRef.current = null;
      return;
    }

    const currentTrack = mediaDetails.subtitleTracks.find((t) => t.id === selectedSubId);
    if (!currentTrack || !currentTrack.url) {
      setCues([]);
      setCuesLoaded(true);
      setActiveCue(null);
      activeCueRef.current = null;
      return;
    }

    let cancelled = false;
    setCuesLoaded(false);
    setActiveCue(null);
    activeCueRef.current = null;

    fetch(currentTrack.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((vtt) => {
        if (cancelled) return;
        const parsed = parseVttCues(vtt);
        setCues(parsed);
        setCuesLoaded(true);
        if (videoRef.current) {
          const active = findActiveCue(parsed, videoRef.current.currentTime, subDelayRef.current);
          setActiveCue(active);
          activeCueRef.current = active;
        }
      })
      .catch((err) => {
        console.warn('[Player] Subtitle fetch failed', err);
        if (!cancelled) {
          setCues([]);
          setCuesLoaded(true);
          setActiveCue(null);
          activeCueRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubId, mediaDetails]);

  // Keep native track elements hidden so they don't double-render
  useEffect(() => {
    if (!videoRef.current) return;
    const trackEls = videoRef.current.querySelectorAll('track');
    trackEls.forEach((el) => {
      if (el.track) {
        el.track.mode = 'hidden';
      }
    });
  }, [mediaDetails, selectedSubId]);

  // Update active cue on timeupdate and seeked events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeOrSeek = () => {
      updateCueAtTime(video.currentTime);
    };

    video.addEventListener('timeupdate', onTimeOrSeek);
    video.addEventListener('seeked', onTimeOrSeek);
    return () => {
      video.removeEventListener('timeupdate', onTimeOrSeek);
      video.removeEventListener('seeked', onTimeOrSeek);
    };
  }, [updateCueAtTime]);

  // Expose active subtitle information for inspection and testing
  useEffect(() => {
    const selectedTrack = mediaDetails?.subtitleTracks?.find((t) => t.id === selectedSubId);
    const pathBasename = (p: string) => p.split(/[\\/]/).pop() || p;
    (window as any).__activeSubtitleCue = activeCue
      ? {
          start: activeCue.startTime + subDelayRef.current,
          end: activeCue.endTime + subDelayRef.current,
          origStart: activeCue.startTime,
          origEnd: activeCue.endTime,
          text: activeCue.text,
          currentTime: videoRef.current?.currentTime,
          videoFile: currentFilePath ? pathBasename(currentFilePath) : '',
          fullVideoPath: currentFilePath,
          subtitleFile: selectedTrack?.label || selectedTrack?.path || selectedSubId,
          delay: subDelayRef.current
        }
      : null;
    (window as any).__subtitleCues = cues;
    (window as any).__findActiveCue = (t: number) => findActiveCue(cuesRef.current, t, subDelayRef.current);
  }, [activeCue, cues, currentFilePath, selectedSubId, mediaDetails]);

  // When SettingsModal opens on top of player, pause video, disable auto-hide, keep controls visible
  useEffect(() => {
    if (isSettingsOpen) {
      if (isPlaying) {
        pause();
      }
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isSettingsOpen, isPlaying, pause]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (activePlayerRef.current !== 'main' || isSettingsOpen) return;
      if (
        lastPointerPosRef.current &&
        lastPointerPosRef.current.x === e.clientX &&
        lastPointerPosRef.current.y === e.clientY
      ) {
        return; // Synthetic mousemove without pointer coordinate change
      }
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      resetControlsTimeout();
    };

    const handlePointerClick = (e: MouseEvent) => {
      if (activePlayerRef.current !== 'main' || isSettingsOpen) return;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
      resetControlsTimeout();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handlePointerClick);
    window.addEventListener('click', handlePointerClick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handlePointerClick);
      window.removeEventListener('click', handlePointerClick);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout, isSettingsOpen]);

  // Show controls on initial mount for 3 seconds then auto-hide
  useEffect(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePlayerRef.current !== 'main') return;
      // When Settings is open, disable all player shortcuts so typing in inputs doesn't trigger playback actions
      if (isSettingsOpen) return;
      if (!videoRef.current) return;

      if (e.key === '[' || e.code === 'BracketLeft') {
        e.preventDefault();
        updateSubDelay(subDelayRef.current - 0.1);
        return;
      }
      if (e.key === ']' || e.code === 'BracketRight') {
        e.preventDefault();
        updateSubDelay(subDelayRef.current + 0.1);
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-5);
          break;
        case 'KeyJ':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(5);
          break;
        case 'KeyL':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.05);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyN':
          e.preventDefault();
          if (hasNextEpisode && onNextEpisode) onNextEpisode();
          break;
        case 'Escape':
          e.preventDefault();
          if (showSettings) {
            setShowSettings(false);
          } else if (showEpisodesDrawer) {
            setShowEpisodesDrawer(false);
          } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            handlePlayerClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTime,
    togglePlay,
    seekTo,
    changeVolume,
    toggleMute,
    hasNextEpisode,
    onNextEpisode,
    showSettings,
    showEpisodesDrawer,
    onClose
  ]);

  // Mouse wheel volume control
  useEffect(() => {
    let wheelAccumulator = 0;
    let wheelTimer: NodeJS.Timeout | null = null;

    const isInsideScrollable = (el: HTMLElement | null): boolean => {
      let curr = el;
      while (curr && curr !== containerRef.current && curr !== document.body) {
        if (curr.classList.contains('episodes-drawer') || curr.classList.contains('settings-modal')) {
          return true;
        }
        const style = window.getComputedStyle(curr);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
          return true;
        }
        curr = curr.parentElement;
      }
      return false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (activePlayerRef.current !== 'main' || isSettingsOpen) return;

      const target = e.target as HTMLElement | null;
      if (isInsideScrollable(target)) {
        return;
      }

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
  }, [changeVolume, resetControlsTimeout, isSettingsOpen]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen?.() || containerRef.current?.requestFullscreen?.())
        ?.then(() => setIsFullscreen(true))
        ?.catch(() => {});
    } else {
      document.exitFullscreen()
        ?.then(() => setIsFullscreen(false))
        ?.catch(() => {});
    }
  }, []);

  // Keep isFullscreen in sync with actual document fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Exact Seek Bar handlers using pointer events and getBoundingClientRect
  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekTrackRef.current || duration <= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingSeek(true);
    const rect = seekTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    seekTo(target);
    setHoverPosition(ratio * 100);
    setHoverTime(target);
  };

  const handleSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekTrackRef.current || duration <= 0) return;
    const rect = seekTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);
    if (isDraggingSeek) {
      seekTo(ratio * duration);
    }
  };

  const handleSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSeek) {
      setIsDraggingSeek(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleSeekPointerEnter = () => {
    setIsHoveringSeek(true);
  };

  const handleSeekPointerLeave = () => {
    if (!isDraggingSeek) {
      setIsHoveringSeek(false);
      setHoverTime(null);
    }
  };

  // Subtitle cue styling: hide browser native cues so only our binary-searched custom overlay renders
  const customCueStyle = `
    video::cue {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
    }
  `;

  return (
    <div
      className={`video-player-container ${showControls ? '' : 'player-cursor-hidden'}`}
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: showControls ? 'default' : 'none',
        display: activePlayer === 'mini' ? 'none' : 'flex'
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, .player-controls')) return;
        toggleFullscreen();
      }}
    >
      <style>{customCueStyle}</style>

      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        onTimeUpdate={hookTimeUpdate}
        onSeeking={handleSeeking}
        onWaiting={handleWaiting}
        onSeeked={handleSeeked}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPause={() => {
          handlePause();
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            const isDirectNow = (mediaDetails?.isDirectPlayable ?? true) && selectedAudioIndex === 0;
            // Preserve real duration from ffprobe for ffmpeg streams
            if (isDirectNow && (!mediaDetails || !mediaDetails.duration || mediaDetails.duration <= 0)) {
              if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
                setDuration(videoRef.current.duration);
              }
            } else if (mediaDetails?.duration && mediaDetails.duration > 0) {
              setDuration(mediaDetails.duration);
            }
            videoRef.current.volume = volume;
            videoRef.current.playbackRate = playbackSpeed;
          }
        }}
        onError={() => {
          console.warn('[Player] Video element error');
          setVideoError('Video playback error. Please check format or retry.');
        }}
        onEnded={hookEnded}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        style={{
          width: '100%',
          height: '100%',
          objectFit: aspectRatio === 'fill' ? 'fill' : aspectRatio === 'cover' ? 'cover' : 'contain',
          backgroundColor: '#000',
          cursor: showControls ? 'default' : 'none'
        }}
      >
        {mediaDetails?.subtitleTracks?.map((sub) => (
          <track
            key={sub.id}
            id={sub.id}
            kind="subtitles"
            label={sub.label}
            src={sub.url}
          />
        ))}
      </video>

      {/* Buffering & Seeking Spinner: keeps last frame visible, shows spinner over it, never black screen */}
      {(isBuffering || !mediaDetails) && !videoError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}
        >
          <div className="netflix-spinner" />
        </div>
      )}

      {/* Video Loading/Error Overlay */}
      {videoError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100,
            gap: '16px'
          }}
        >
          <img src={logoPng} alt="NetFlixxy" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
          <span style={{ fontSize: '15px', color: '#ccc', fontWeight: 600 }}>{videoError}</span>
          <button
            onClick={() => {
              setVideoError(null);
              if (videoRef.current) {
                videoRef.current.src = (window as any).electronAPI?.getStreamUrl(currentFilePath, currentTime);
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }}
            style={{
              background: '#e50914',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 20px',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RotateCcw size={16} />
            <span>Retry Playback</span>
          </button>
        </div>
      )}

      {/* Subtitle Cue Overlay (Rendered using binary search over sorted cues, with delay applied once) */}
      {activeCue && cuesLoaded && selectedSubId !== 'off' && (
        <div
          className="custom-subtitle-overlay"
          style={{
            position: 'absolute',
            bottom: showControls ? '92px' : '44px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '85%',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 140,
            transition: 'bottom 0.2s ease',
            fontSize: `${subFontSize}px`,
            color: subColor,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: '4px 14px',
            borderRadius: '4px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 2px #000',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            whiteSpace: 'pre-wrap',
            lineHeight: 1.35
          }}
        >
          {activeCue.text}
        </div>
      )}

      {/* Center Popup (One mounted element, 64px, 120ms fade-in, 600ms hold, 300ms fade-out, 80ms pulse) */}
      <CenterPopup ref={centerPopupRef} />

      {/* On-screen Subtitle Delay Pill */}
      {delayPillText && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 15, 15, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '20px',
            padding: '8px 18px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            pointerEvents: 'none',
            zIndex: 260,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            letterSpacing: '0.3px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {delayPillText}
        </div>
      )}

      {/* Skip Badge (Top-Left 24px) */}
      <SkipBadge data={skipBadge} />

      {/* Top Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '24px 36px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
          zIndex: 210,
          pointerEvents: showControls ? 'auto' : 'none'
        }}
      >
        <button
          onClick={handlePlayerClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '17px',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <ArrowLeft size={22} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logoPng} alt="NetFlixxy" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '0.2px' }}>
                {currentTitle}
              </span>
              <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 500 }}>
                {currentResolution} • {isDirect ? 'Direct Play' : 'FFmpeg Stream'}
              </span>
            </div>
          </div>
        </button>

        {/* Brand label on the right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: '#777', fontWeight: 700, letterSpacing: '1px' }}>
            NetFlixxy
          </span>
        </div>
      </div>

      {/* Next Episode Floating Card (End of episode countdown: last 5 seconds only) */}
      {nextCountdown !== null && isSeries && hasNextEpisode && (
        <div
          style={{
            position: 'absolute',
            bottom: '120px',
            right: '48px',
            background: 'rgba(24,24,24,0.96)',
            border: '1px solid #e50914',
            borderRadius: '10px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 220,
            boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
            backdropFilter: 'blur(12px)',
            animation: 'modalIn 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', fontSize: '13px' }}>
            <Clock size={16} color="#e50914" />
            <span>Next episode playing in <b style={{ color: '#fff' }}>{nextCountdown}s</b></span>
          </div>
          <button
            onClick={() => {
              setNextCountdown(null);
              autoPlayedRef.current = true;
              if (onNextEpisode) onNextEpisode();
            }}
            style={{
              background: '#e50914',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(229, 9, 20, 0.4)'
            }}
          >
            <FastForward size={18} />
            <span>Play Next Episode</span>
          </button>
        </div>
      )}

      {/* Netflix-style Episode Preview Drawer */}
      {showEpisodesDrawer && isSeries && series && (
        <div
          className="episodes-drawer"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '420px',
            maxWidth: '90vw',
            background: 'rgba(18, 18, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid #333',
            zIndex: 250,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 35px rgba(0,0,0,0.85)',
            animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid #282828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                {series.title}
              </h3>
              {/* Season Selector */}
              {seasonsList.length > 1 ? (
                <select
                  value={drawerSeason}
                  onChange={(e) => setDrawerSeason(Number(e.target.value))}
                  style={{
                    background: '#282828',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {seasonsList.map((sNum) => (
                    <option key={sNum} value={sNum}>
                      Season {sNum}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '13px', color: '#999', fontWeight: 600 }}>Season 1</span>
              )}
            </div>
            <button
              onClick={() => setShowEpisodesDrawer(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Episode Scroll List (Memoized so it doesn't re-render during playback) */}
          <MemoizedEpisodeList
            episodes={series.seasons[drawerSeason] || []}
            currentEpisodeId={episode?.filePath || null}
            currentEpisode={episode}
            progressMap={progressMap}
            onSelectEpisode={onSelectEpisode}
            onCloseDrawer={() => setShowEpisodesDrawer(false)}
          />
        </div>
      )}

      {/* Settings Modal (Edit Quality & Subtitles) */}
      {showSettings && (
        <div
          className="settings-modal"
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '36px',
            width: '380px',
            maxWidth: '92vw',
            background: 'rgba(20, 20, 20, 0.98)',
            border: '1px solid #333',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.95)',
            backdropFilter: 'blur(16px)',
            zIndex: 250,
            overflow: 'hidden',
            animation: 'modalIn 0.2s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Settings Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #2a2a2a',
              background: '#161616'
            }}
          >
            <button
              onClick={() => setSettingsTab('audio')}
              style={{
                flex: 1,
                padding: '14px 6px',
                background: 'none',
                border: 'none',
                borderBottom: settingsTab === 'audio' ? '2px solid #e50914' : '2px solid transparent',
                color: settingsTab === 'audio' ? '#fff' : '#888',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Volume2 size={16} color={settingsTab === 'audio' ? '#e50914' : '#888'} />
              <span>Audio</span>
            </button>
            <button
              onClick={() => setSettingsTab('subtitles')}
              style={{
                flex: 1,
                padding: '14px 6px',
                background: 'none',
                border: 'none',
                borderBottom: settingsTab === 'subtitles' ? '2px solid #e50914' : '2px solid transparent',
                color: settingsTab === 'subtitles' ? '#fff' : '#888',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Captions size={16} color={settingsTab === 'subtitles' ? '#e50914' : '#888'} />
              <span>Subtitles</span>
            </button>
            <button
              onClick={() => setSettingsTab('quality')}
              style={{
                flex: 1,
                padding: '14px 6px',
                background: 'none',
                border: 'none',
                borderBottom: settingsTab === 'quality' ? '2px solid #e50914' : '2px solid transparent',
                color: settingsTab === 'quality' ? '#fff' : '#888',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={16} color={settingsTab === 'quality' ? '#e50914' : '#888'} />
              <span>Quality</span>
            </button>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                padding: '0 14px',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Settings Content */}
          <div style={{ padding: '20px', maxHeight: '390px', overflowY: 'auto' }}>
            {settingsTab === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Select Audio Track
                  </span>
                  <span style={{ fontSize: '11px', color: '#e50914', fontWeight: 700 }}>
                    {mediaDetails?.audioTracks?.length || 1} Detected
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mediaDetails?.audioTracks && mediaDetails.audioTracks.length > 0 ? (
                    mediaDetails.audioTracks.map((track) => {
                      const isSelected = selectedAudioIndex === track.audioIndex;
                      return (
                        <button
                          key={track.audioIndex}
                          onClick={() => handleAudioChange(track.audioIndex)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid #e50914' : '1px solid #333',
                            background: isSelected ? 'rgba(229, 9, 20, 0.2)' : '#222',
                            color: isSelected ? '#fff' : '#aaa',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <Volume2 size={18} color={isSelected ? '#e50914' : '#666'} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                                {track.label}
                              </div>
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                {track.codec.toUpperCase()} • {track.channels} Channels ({track.layout || 'Stereo'})
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check size={18} color="#e50914" />}
                        </button>
                      );
                    })
                  ) : (
                    <button
                      style={{
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: '1px solid #e50914',
                        background: 'rgba(229, 9, 20, 0.2)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Volume2 size={18} color="#e50914" />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                            Default Audio Track
                          </div>
                          <div style={{ fontSize: '11px', color: '#888' }}>
                            {mediaDetails?.aCodec?.toUpperCase() || 'Stereo'}
                          </div>
                        </div>
                      </div>
                      <Check size={18} color="#e50914" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {settingsTab === 'subtitles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Subtitle Track Selection */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Select Subtitle Track
                    </span>
                    <span style={{ fontSize: '11px', color: '#e50914', fontWeight: 700 }}>
                      {mediaDetails?.subtitleTracks?.length || 0} Detected
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => setSelectedSubId('off')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: selectedSubId === 'off' ? '1px solid #e50914' : '1px solid #333',
                        background: selectedSubId === 'off' ? 'rgba(229, 9, 20, 0.2)' : '#222',
                        color: selectedSubId === 'off' ? '#fff' : '#aaa',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Off</span>
                      {selectedSubId === 'off' && <Check size={16} color="#e50914" />}
                    </button>

                    {mediaDetails?.subtitleTracks && mediaDetails.subtitleTracks.length > 0 ? (
                      mediaDetails.subtitleTracks.map((sub) => {
                        const isSelected = selectedSubId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedSubId(sub.id)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #e50914' : '1px solid #333',
                              background: isSelected ? 'rgba(229, 9, 20, 0.2)' : '#222',
                              color: isSelected ? '#fff' : '#aaa',
                              fontSize: '13px',
                              fontWeight: 600,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <Captions size={16} color={isSelected ? '#e50914' : '#666'} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {sub.label}
                                </div>
                                <div style={{ fontSize: '10px', color: '#888' }}>
                                  {sub.type === 'embedded' ? `Embedded (${sub.codec?.toUpperCase() || 'SRT'})` : 'External File'}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check size={16} color="#e50914" />}
                          </button>
                        );
                      })
                    ) : (
                      <div style={{ padding: '8px 12px', background: '#1c1c1c', borderRadius: '4px', border: '1px dashed #333', color: '#777', fontSize: '12px' }}>
                        No embedded or external subtitle tracks found in this file.
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtitle Font Size */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Subtitle Size
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                    {[
                      { size: 16, label: 'Small' },
                      { size: 22, label: 'Medium' },
                      { size: 28, label: 'Large' },
                      { size: 36, label: 'Huge' }
                    ].map((item) => (
                      <button
                        key={item.size}
                        onClick={() => setSubFontSize(item.size)}
                        style={{
                          padding: '8px 0',
                          borderRadius: '4px',
                          border: subFontSize === item.size ? '1px solid #e50914' : '1px solid #333',
                          background: subFontSize === item.size ? 'rgba(229, 9, 20, 0.2)' : '#222',
                          color: subFontSize === item.size ? '#fff' : '#aaa',
                          fontSize: '12px',
                          fontWeight: subFontSize === item.size ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Color */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Subtitle Color
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                    {[
                      { color: '#ffffff', label: 'White' },
                      { color: '#f5c518', label: 'Yellow' },
                      { color: '#00f0ff', label: 'Cyan' }
                    ].map((item) => (
                      <button
                        key={item.color}
                        onClick={() => setSubColor(item.color)}
                        style={{
                          padding: '8px 0',
                          borderRadius: '4px',
                          border: subColor === item.color ? '1px solid #e50914' : '1px solid #333',
                          background: subColor === item.color ? 'rgba(229, 9, 20, 0.2)' : '#222',
                          color: item.color,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Delay Controls */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Subtitle Delay
                    </span>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {subDelay >= 0 ? '+' : ''}{subDelay.toFixed(1)} s
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => updateSubDelay(subDelay - 0.1)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '4px',
                        border: '1px solid #333',
                        background: '#222',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Step back 0.1s ([ key)"
                    >
                      - 0.1s
                    </button>
                    <button
                      onClick={() => updateSubDelay(0)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '4px',
                        border: '1px solid #333',
                        background: '#222',
                        color: '#aaa',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title="Reset Subtitle Delay"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => updateSubDelay(subDelay + 0.1)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '4px',
                        border: '1px solid #333',
                        background: '#222',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Step forward 0.1s (] key)"
                    >
                      + 0.1s
                    </button>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'quality' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Video Quality Info */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Video Quality & Codec
                  </span>
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 14px',
                      background: '#222',
                      borderRadius: '6px',
                      border: '1px solid #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                        {currentResolution} • {mediaDetails?.vCodec?.toUpperCase() || 'H.264'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {isDirect ? 'Direct Playback (Source)' : 'FFmpeg Stream Remux'}
                      </div>
                    </div>
                    <span
                      style={{
                        background: '#e50914',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}
                    >
                      {isDirect ? 'DIRECT' : 'TRANSCODE'}
                    </span>
                  </div>
                </div>

                {/* Playback Speed */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Playback Speed
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setPlaybackSpeed(rate)}
                        style={{
                          padding: '8px 0',
                          borderRadius: '4px',
                          border: playbackSpeed === rate ? '1px solid #e50914' : '1px solid #333',
                          background: playbackSpeed === rate ? 'rgba(229, 9, 20, 0.2)' : '#222',
                          color: playbackSpeed === rate ? '#fff' : '#aaa',
                          fontSize: '13px',
                          fontWeight: playbackSpeed === rate ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {rate === 1.0 ? '1.0x Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio / Fit */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Aspect Ratio
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                    {[
                      { key: 'contain', label: 'Contain' },
                      { key: 'cover', label: 'Fill Screen' },
                      { key: 'fill', label: 'Stretch' }
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        onClick={() => setAspectRatio(mode.key as any)}
                        style={{
                          padding: '8px 0',
                          borderRadius: '4px',
                          border: aspectRatio === mode.key ? '1px solid #e50914' : '1px solid #333',
                          background: aspectRatio === mode.key ? 'rgba(229, 9, 20, 0.2)' : '#222',
                          color: aspectRatio === mode.key ? '#fff' : '#aaa',
                          fontSize: '13px',
                          fontWeight: aspectRatio === mode.key ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className={`player-controls ${!showControls ? 'hidden-controls' : ''}`}>
        {/* Exact Pointer Seek Bar */}
        <div
          ref={seekTrackRef}
          className="seek-bar-container"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
              e.preventDefault();
            }
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            touchAction: 'none',
            marginBottom: '10px',
            outline: 'none'
          }}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={handleSeekPointerUp}
          onPointerEnter={handleSeekPointerEnter}
          onPointerLeave={handleSeekPointerLeave}
        >
          {/* Hover Time Tooltip (above pointer) */}
          {hoverTime !== null && (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: `${hoverPosition}%`,
                transform: 'translateX(-50%)',
                background: 'rgba(15, 15, 15, 0.95)',
                border: '1px solid #444',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: '6px',
                pointerEvents: 'none',
                boxShadow: '0 6px 20px rgba(0,0,0,0.85)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 220
              }}
            >
              <span>{formatMediaTime(hoverTime, duration >= 3600)}</span>
            </div>
          )}

          {/* Track background (unwatched: dark gray) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: isHoveringSeek || isDraggingSeek ? '6px' : '4px',
              backgroundColor: '#333333',
              borderRadius: '3px',
              transition: 'height 0.15s ease',
              overflow: 'hidden'
            }}
          >
            {/* Hover ghost highlight */}
            {hoverPosition > 0 && isHoveringSeek && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${hoverPosition}%`,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* Watched progress fill (pure white) */}
            <div
              ref={progressFillRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
                backgroundColor: '#ffffff',
                pointerEvents: 'none',
                transition: isDraggingSeek ? 'none' : 'width 0.1s linear'
              }}
            />
          </div>

          {/* Scrubber thumb handle (red) */}
          <div
            ref={scrubberThumbRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
              transform: 'translate(-50%, -50%)',
              width: isHoveringSeek || isDraggingSeek ? '14px' : '0px',
              height: isHoveringSeek || isDraggingSeek ? '14px' : '0px',
              borderRadius: '50%',
              backgroundColor: '#e50914',
              boxShadow: '0 0 6px rgba(0,0,0,0.8), 0 0 2px #fff',
              transition: isDraggingSeek ? 'none' : 'width 0.15s ease, height 0.15s ease',
              pointerEvents: 'none',
              zIndex: 2
            }}
          />
        </div>

        {/* Action Controls Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left Actions: Skip Back, Play/Pause, Skip Forward, Next Episode, Time Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Skip Back 5s */}
            <button
              onClick={() => skip(-5)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                padding: '4px',
                transition: 'transform 0.15s ease'
              }}
              title="Rewind 5s (Left Arrow)"
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e50914')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#fff')}
            >
              <RotateCcw size={22} />
              <span style={{ position: 'absolute', fontSize: '9px', fontWeight: 800, top: '50%', left: '50%', transform: 'translate(-50%, -42%)' }}>
                5
              </span>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={26} /> : <Play size={26} fill="#fff" />}
            </button>

            {/* Skip Forward 5s */}
            <button
              onClick={() => skip(5)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                padding: '4px',
                transition: 'transform 0.15s ease'
              }}
              title="Forward 5s (Right Arrow)"
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e50914')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#fff')}
            >
              <RotateCw size={22} />
              <span style={{ position: 'absolute', fontSize: '9px', fontWeight: 800, top: '50%', left: '50%', transform: 'translate(-50%, -42%)' }}>
                5
              </span>
            </button>

            {/* Next Episode Button */}
            {isSeries && (
              <button
                onClick={onNextEpisode}
                disabled={!hasNextEpisode}
                title={hasNextEpisode ? 'Next Episode (N)' : 'No Next Episode'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: hasNextEpisode ? '#fff' : '#555',
                  cursor: hasNextEpisode ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  transition: 'color 0.2s, transform 0.15s'
                }}
                onMouseEnter={(e) => hasNextEpisode && (e.currentTarget.style.color = '#e50914')}
                onMouseLeave={(e) => hasNextEpisode && (e.currentTarget.style.color = '#fff')}
              >
                <SkipForward size={24} fill={hasNextEpisode ? '#fff' : 'none'} />
              </button>
            )}

            {/* Time Stamp */}
            <span ref={timeLabelRef} style={{ fontSize: '13px', color: '#aaa', fontWeight: 500, marginLeft: '6px' }}>
              {formatMediaTime(currentTime, duration >= 3600)} / {formatMediaTime(duration, duration >= 3600)}
            </span>
          </div>

          {/* Right Actions: Volume (Icon + Slider + %), Episodes, Subtitles/Settings, Mini Player, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
            {/* Volume Control: 1% to 100%, mute toggle, animated level bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
                title="Mute / Unmute (M)"
              >
                <VolumeIcon volume={volume} isMuted={isMuted} size={22} isAnimating={volumeMeterActive} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={isMuted ? 0 : Math.round(volume * 100)}
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setVolumeLevel(val / 100, false);
                }}
                style={{ width: '80px', accentColor: '#e50914', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: '12px',
                  color: '#ccc',
                  minWidth: '34px',
                  textAlign: 'left',
                  fontWeight: 600
                }}
              >
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Netflix-style Episodes Selector Button */}
            {isSeries && (
              <button
                onClick={() => {
                  setShowEpisodesDrawer(!showEpisodesDrawer);
                  setShowSettings(false);
                }}
                aria-label="Episodes"
                title="Episodes"
                style={{
                  background: showEpisodesDrawer ? 'rgba(229, 9, 20, 0.2)' : 'none',
                  border: showEpisodesDrawer ? '1px solid #e50914' : '1px solid transparent',
                  borderRadius: '6px',
                  color: showEpisodesDrawer ? '#e50914' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                <ListVideo size={20} />
              </button>
            )}

            {/* Audio & Subtitles Menu */}
            <button
              onClick={() => {
                setShowSettings(!showSettings);
                setShowEpisodesDrawer(false);
              }}
              title="Audio Tracks & Subtitles"
              style={{
                background: showSettings ? 'rgba(229, 9, 20, 0.2)' : 'none',
                border: showSettings ? '1px solid #e50914' : '1px solid transparent',
                borderRadius: '6px',
                color: showSettings ? '#e50914' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <Captions size={20} />
              <span>Audio & Subs</span>
            </button>

            {/* Mini Player (PiP) Button */}
            <button
              onClick={handleOpenMiniPlayer}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                transition: 'color 0.15s ease'
              }}
              title="Mini Player (Ctrl+M)"
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e50914')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#fff')}
            >
              <PictureInPicture size={22} />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
