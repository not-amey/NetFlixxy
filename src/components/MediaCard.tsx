import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Check, Star, Info } from 'lucide-react';
import { NetflixBadge } from './NetflixLogo';
import { MediaItem, WatchProgress } from '../types/media';

interface MediaCardProps {
  item: MediaItem;
  progress?: WatchProgress | null;
  isWatched?: boolean;
  watchedRating?: number | null;
  onSelect: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
  onMarkWatched?: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  progress,
  isWatched = false,
  watchedRating = null,
  onSelect,
  onPlayDirect,
  onMarkWatched
}) => {
  const [imageError, setImageError] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  const isSeries = item.type === 'series';
  const posterPath = item.poster || item.backdrop || null;

  const thumbUrl =
    posterPath && !imageError && (window as any).electronAPI
      ? (window as any).electronAPI.getThumbUrl(posterPath)
      : null;

  return (
    <div
      className="media-card group"
      onClick={() => onSelect(item)}
      onContextMenu={(e) => {
        if (onMarkWatched) {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }
      }}
      style={{
        flex: '0 0 200px',
        position: 'relative',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: '#181818'
      }}
    >
      {/* Netflix 'N' Emblem Badge */}
      <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
        <NetflixBadge size={13} />
      </div>

      {/* Watched & Rating Badge */}
      {isWatched && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
            letterSpacing: '0.04em'
          }}
        >
          <Check size={11} strokeWidth={3} />
          {watchedRating ? `★ ${watchedRating}` : 'WATCHED'}
        </div>
      )}

      {/* Poster Image or Gradient fallback */}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={item.title}
          className="card-poster"
          loading="lazy"
          onError={() => setImageError(true)}
          style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="card-gradient-bg"
          style={{
            width: '100%',
            aspectRatio: '2/3',
            background: 'linear-gradient(135deg, #2b1114 0%, #1a1618 60%, #121212 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '14px'
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#e50914',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            {isSeries ? 'Series' : 'Movie'}
          </span>
          <h4
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2
            }}
          >
            {item.title}
          </h4>
        </div>
      )}

      {/* Hover Info Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 12px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.92) 80%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '140px'
            }}
          >
            {item.title}
          </h4>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayDirect(item);
              }}
              title="Play immediately"
              style={{
                background: '#e50914',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Play size={12} fill="#fff" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#aaa' }}>
          {item.year && <span>{item.year}</span>}
          {isSeries && <span>{Object.keys((item as any).seasons || {}).length} Season(s)</span>}
          {!isSeries && (item as any).resolution && (
            <span style={{ border: '1px solid #555', padding: '0 4px', borderRadius: '2px', fontSize: '10px' }}>
              {(item as any).resolution}
            </span>
          )}
        </div>
      </div>

      {/* Watch Progress Bar */}
      {progress && progress.percentage > 0 && progress.percentage < 95 && (
        <div className="watch-progress-bar">
          <div
            className="watch-progress-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      )}

      {/* Right-click Context Menu rendered directly into document.body to avoid parent CSS transforms/animations */}
      {contextMenu &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${Math.min(contextMenu.y, window.innerHeight - 160)}px`,
              left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
              zIndex: 999999,
              backgroundColor: '#202020',
              border: '1px solid #383838',
              borderRadius: '8px',
              padding: '6px',
              minWidth: '190px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.95)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              cursor: 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {onMarkWatched && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(null);
                  onMarkWatched(item);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  color: isWatched ? '#10b981' : '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Check size={15} strokeWidth={isWatched ? 3 : 2} color={isWatched ? '#10b981' : '#e50914'} />
                <span>{isWatched ? (watchedRating ? `Edit Rating (${watchedRating}/10)` : 'Edit Rating / Watched') : 'Mark as Watched'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                onPlayDirect(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Play size={14} fill="#fff" />
              <span>Play Now</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                onSelect(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '5px',
                color: '#bbb',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Info size={14} />
              <span>View Details</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
