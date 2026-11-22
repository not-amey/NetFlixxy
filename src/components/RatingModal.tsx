import React, { useState } from 'react';
import { Star, X, Check, Trash2 } from 'lucide-react';
import { MediaItem, WatchedShowItem } from '../types/media';

interface RatingModalProps {
  item: MediaItem | WatchedShowItem;
  currentRating?: number | null;
  isWatched: boolean;
  onSaveRating: (rating: number | null) => void;
  onRemoveWatched?: () => void;
  onClose: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1/10 - Terrible',
  2: '2/10 - Very Bad',
  3: '3/10 - Bad',
  4: '4/10 - Disappointing',
  5: '5/10 - Average',
  6: '6/10 - Fine',
  7: '7/10 - Good',
  8: '8/10 - Great',
  9: '9/10 - Amazing',
  10: '10/10 - Masterpiece'
};

export const RatingModal: React.FC<RatingModalProps> = ({
  item,
  currentRating,
  isWatched,
  onSaveRating,
  onRemoveWatched,
  onClose
}) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(
    currentRating !== undefined ? currentRating : null
  );
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : selectedRating;

  const bannerPath =
    (item as any).backdrop ||
    (item as any).banner ||
    (item as any).poster ||
    null;

  const bannerUrl =
    bannerPath && (window as any).electronAPI
      ? (window as any).electronAPI.getThumbUrl(bannerPath)
      : bannerPath;

  const handleSave = () => {
    onSaveRating(selectedRating);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#181818',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #333',
          boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner header */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '180px',
            backgroundColor: '#111',
            overflow: 'hidden'
          }}
        >
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={item.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.65)'
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #2b1114 0%, #1a1618 60%, #121212 100%)'
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 20px',
              background: 'linear-gradient(180deg, transparent 0%, rgba(24,24,24,0.95) 80%)'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#e50914',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}
            >
              {isWatched ? 'Watched Show' : 'Mark as Watched'}
            </span>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#fff',
                marginTop: '4px',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              {item.title} {item.year ? `(${item.year})` : ''}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background 0.2s'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content & Star rating */}
        <div style={{ padding: '24px 24px 20px' }}>
          <p style={{ fontSize: '14px', color: '#ccc', marginBottom: '16px' }}>
            Rate this show to record your personal rating in the <strong>Watched</strong> list.
            Even if you delete the files later, your rating and banner will be kept.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px 0',
              backgroundColor: '#111',
              borderRadius: '8px',
              border: '1px solid #282828'
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starVal) => {
              const isFilled = displayRating !== null && displayRating >= starVal;
              return (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => setSelectedRating(starVal === selectedRating ? null : starVal)}
                  onMouseEnter={() => setHoverRating(starVal)}
                  onMouseLeave={() => setHoverRating(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: isFilled ? '#f59e0b' : '#444',
                    transition: 'transform 0.15s, color 0.15s'
                  }}
                  onFocus={() => {}}
                >
                  <Star
                    size={26}
                    fill={isFilled ? '#f59e0b' : 'none'}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: '10px',
              minHeight: '22px',
              fontSize: '14px',
              fontWeight: 700,
              color: displayRating ? '#f59e0b' : '#666'
            }}
          >
            {displayRating ? RATING_LABELS[displayRating] || `${displayRating}/10` : 'Click to Rate (Optional)'}
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '24px',
              gap: '12px'
            }}
          >
            {isWatched && onRemoveWatched ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveWatched();
                  onClose();
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#aaa',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#e50914';
                  e.currentTarget.style.color = '#e50914';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#444';
                  e.currentTarget.style.color = '#aaa';
                }}
              >
                <Trash2 size={14} />
                Remove from Watched
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#2a2a2a',
                  border: 'none',
                  color: '#ccc',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                style={{
                  background: '#e50914',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={16} />
                {isWatched ? 'Update Rating' : 'Mark as Watched'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
