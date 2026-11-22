import React from 'react';
import { Star, CheckCircle2, Film, Trash2, Award, Calendar, Layers } from 'lucide-react';
import { WatchedShowItem, MediaItem } from '../types/media';

interface WatchedSectionProps {
  items: WatchedShowItem[];
  libraryShows: MediaItem[];
  onSelectWatched: (item: WatchedShowItem) => void;
  onPlayWatched?: (item: WatchedShowItem) => void;
  onRateShow: (item: WatchedShowItem) => void;
  onRemoveWatched: (id: string) => void;
}

export const WatchedSection: React.FC<WatchedSectionProps> = ({
  items,
  libraryShows,
  onSelectWatched,
  onPlayWatched,
  onRateShow,
  onRemoveWatched
}) => {
  const totalCompleted = items.length;
  const ratedItems = items.filter((i) => i.rating !== null && i.rating !== undefined && i.rating > 0);
  const avgRating =
    ratedItems.length > 0
      ? (ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(1)
      : null;

  return (
    <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px', minHeight: '80vh', paddingBottom: '60px' }}>
      {/* Header & Stats Banner */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Watched
          </h2>
          <span
            style={{
              backgroundColor: 'rgba(229, 9, 20, 0.2)',
              color: '#e50914',
              border: '1px solid rgba(229, 9, 20, 0.4)',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            Permanent Vault
          </span>
        </div>
        <p style={{ color: '#aaa', fontSize: '14px', maxWidth: '720px', lineHeight: 1.5 }}>
          Your permanent vertical vault of completed shows and movies. The list order is strictly locked chronologically, preserving your ratings and banners even when media files are deleted from your storage.
        </p>

        {/* Stats Row */}
        {totalCompleted > 0 && (
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: '#1c1c1c',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <CheckCircle2 size={24} color="#10b981" />
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>{totalCompleted}</div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Titles Completed</div>
              </div>
            </div>

            {avgRating && (
              <div
                style={{
                  backgroundColor: '#1c1c1c',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Award size={24} color="#f59e0b" />
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>{avgRating} / 10</div>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Average Rating</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            backgroundColor: '#181818',
            borderRadius: '12px',
            border: '1px dashed #333',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '40px auto'
          }}
        >
          <Film size={48} color="#555" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#eee', marginBottom: '8px' }}>
            No Watched Shows Yet
          </h3>
          <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.5, maxWidth: '420px' }}>
            Right-click any show or finish watching a series to add it here. Your ratings and banners remain permanently locked.
          </p>
        </div>
      ) : (
        /* Vertical List of Watched Shows */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxWidth: '1200px'
          }}
        >
          {items.map((item, index) => {
            const bannerPath = item.backdrop || item.banner || item.poster || null;
            const bannerUrl =
              bannerPath && (window as any).electronAPI
                ? (window as any).electronAPI.getThumbUrl(bannerPath)
                : bannerPath;

            const stillInLibrary = libraryShows.some(
              (s) => s.id === item.id || (s.title && s.title.toLowerCase() === item.title.toLowerCase())
            );

            const completedDateStr = item.completedAt
              ? new Date(item.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
              : null;

            return (
              <div
                key={item.id}
                onClick={() => onSelectWatched(item)}
                style={{
                  backgroundColor: '#181818',
                  borderRadius: '10px',
                  border: '1px solid #282828',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e1e1e';
                  e.currentTarget.style.borderColor = '#444';
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#181818';
                  e.currentTarget.style.borderColor = '#282828';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 1. Left: Show Banner Thumbnail (16:9 cinematic ratio) */}
                <div
                  style={{
                    width: '240px',
                    aspectRatio: '16/9',
                    position: 'relative',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    backgroundColor: '#111',
                    flexShrink: 0
                  }}
                >
                  {bannerUrl ? (
                    <img
                      src={bannerUrl}
                      alt={item.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #2b1114 0%, #1a1618 60%, #121212 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Film size={32} color="#555" />
                    </div>
                  )}

                  {/* Position Badge (#1, #2...) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      backdropFilter: 'blur(4px)',
                      color: '#ddd',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    #{index + 1}
                  </div>

                  {/* Watched Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      left: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.95)',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <CheckCircle2 size={11} strokeWidth={3} />
                    WATCHED
                  </div>
                </div>

                {/* 2. Middle: Title, Meta, and Synopsis */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3
                      style={{
                        fontSize: '19px',
                        fontWeight: 800,
                        color: '#fff',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.title}
                    </h3>

                    {item.year && (
                      <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>
                        ({item.year})
                      </span>
                    )}

                    {!stillInLibrary && (
                      <span
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        Archived (Files removed from disk)
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#aaa', flexWrap: 'wrap' }}>
                    {item.type === 'movie' || !item.totalSeasons ? (
                      <span style={{ border: '1px solid #444', padding: '1px 7px', borderRadius: '3px', fontSize: '11px', color: '#ccc', fontWeight: 600 }}>
                        Movie
                      </span>
                    ) : (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Layers size={13} color="#888" />
                          {item.totalSeasons} Season{item.totalSeasons !== 1 ? 's' : ''}
                        </span>

                        {item.totalEpisodes && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Film size={13} color="#888" />
                            {item.totalEpisodes} Episodes
                          </span>
                        )}
                      </>
                    )}

                    {completedDateStr && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#777' }}>
                        <Calendar size={13} color="#666" />
                        Completed on {completedDateStr}
                      </span>
                    )}
                  </div>

                  {/* Overview */}
                  {item.overview && (
                    <p
                      style={{
                        fontSize: '13px',
                        color: '#999',
                        lineHeight: 1.5,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {item.overview}
                    </p>
                  )}
                </div>

                {/* 3. Right: Rating Badge & Quick Actions */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '12px',
                    flexShrink: 0
                  }}
                >
                  {/* Rating button / badge */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRateShow(item);
                    }}
                    style={{
                      background: item.rating ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${item.rating ? 'rgba(245, 158, 11, 0.4)' : '#383838'}`,
                      borderRadius: '6px',
                      padding: '7px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: 'pointer',
                      color: item.rating ? '#f59e0b' : '#bbb',
                      fontSize: '13px',
                      fontWeight: 700,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                      e.currentTarget.style.borderColor = '#f59e0b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = item.rating ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.borderColor = item.rating ? 'rgba(245, 158, 11, 0.4)' : '#383838';
                    }}
                    title="Click to change your rating"
                  >
                    <Star size={16} fill={item.rating ? '#f59e0b' : 'none'} strokeWidth={2} />
                    <span>{item.rating ? `Our Rating: ${item.rating}/10` : 'Add Rating'}</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove "${item.title}" from your Watched vault?`)) {
                          onRemoveWatched(item.id);
                        }
                      }}
                      title="Remove from Watched vault"
                      style={{
                        background: 'transparent',
                        border: '1px solid #333',
                        color: '#666',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#e50914';
                        e.currentTarget.style.color = '#e50914';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#333';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
