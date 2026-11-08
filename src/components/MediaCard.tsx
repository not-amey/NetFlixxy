import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { NetflixBadge } from './NetflixLogo';
import { MediaItem, WatchProgress } from '../types/media';

interface MediaCardProps {
  item: MediaItem;
  progress?: WatchProgress | null;
  onSelect: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  progress,
  onSelect,
  onPlayDirect
}) => {
  const [imageError, setImageError] = useState(false);

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
              color: '#fff'
            }}
          >
            <Play size={12} fill="#fff" />
          </button>
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
    </div>
  );
};
