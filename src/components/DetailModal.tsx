import React, { useState } from 'react';
import { X, Play, Clock, Folder } from 'lucide-react';
import { MediaItem, SeriesItem, EpisodeItem, WatchProgress } from '../types/media';
import { getSeriesResumeEpisode } from '../utils/progress';

interface DetailModalProps {
  item: MediaItem;
  progressMap: Record<string, WatchProgress>;
  onClose: () => void;
  onPlayEpisode: (item: MediaItem, episode?: EpisodeItem) => void;
}

interface EpisodeThumbnailProps {
  ep: EpisodeItem;
  fallbackUrl: string | null;
}

const EpisodeThumbnail: React.FC<EpisodeThumbnailProps> = ({ ep, fallbackUrl }) => {
  const [hasError, setHasError] = useState(false);
  const epThumb = (window as any).electronAPI?.getThumbUrl(ep.thumbnail || ep.filePath);
  const src = !hasError && epThumb ? epThumb : fallbackUrl;

  return (
    <div
      style={{
        width: '130px',
        aspectRatio: '16/9',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: '#181818',
        position: 'relative',
        flexShrink: 0
      }}
    >
      {src ? (
        <img
          src={src}
          alt={ep.title}
          onError={() => setHasError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #2b1114 0%, #1a1a1a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>
            {ep.episode ? `EP ${ep.episode}` : 'EP'}
          </span>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)'
        }}
      >
        <Play size={20} fill="#fff" color="#fff" />
      </div>
    </div>
  );
};

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  progressMap,
  onClose,
  onPlayEpisode
}) => {
  const isSeries = item.type === 'series';
  const series = isSeries ? (item as SeriesItem) : null;
  const resumeInfo = series ? getSeriesResumeEpisode(series, progressMap) : null;
  const currentEpFilePath = resumeInfo?.episode?.filePath;

  const seasonsList = series ? Object.keys(series.seasons).map(Number).sort((a, b) => a - b) : [];
  const [selectedSeason, setSelectedSeason] = useState<number>(seasonsList[0] || 1);

  const episodes = series && series.seasons[selectedSeason] ? series.seasons[selectedSeason] : [];

  const backdropPath = item.backdrop || item.poster || null;
  const backdropUrl =
    backdropPath && (window as any).electronAPI
      ? (window as any).electronAPI.getThumbUrl(backdropPath)
      : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Backdrop Header */}
        <div
          style={{
            position: 'relative',
            height: '380px',
            width: '100%',
            background: backdropUrl
              ? `linear-gradient(180deg, transparent 40%, #181818 100%), url('${backdropUrl}') center/cover no-repeat`
              : 'linear-gradient(135deg, #331518 0%, #181818 100%)'
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.7)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={20} />
          </button>

          {/* Title & Play on Header */}
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '32px',
              right: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <h2 className="brand-font" style={{ fontSize: '38px', fontWeight: 800 }}>
              {item.title}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => onPlayEpisode(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e50914',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '4px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Play size={18} fill="#fff" />
                <span>Play</span>
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#aaa' }}>
                {item.year && <span>{item.year}</span>}
                {!isSeries && (item as any).resolution && (
                  <span style={{ border: '1px solid #666', padding: '1px 6px', borderRadius: '3px' }}>
                    {(item as any).resolution}
                  </span>
                )}
                {isSeries && <span>{seasonsList.length} Season(s)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 32px' }}>
          {/* Metadata & Overview */}
          <div style={{ marginBottom: '28px', color: '#ccc', fontSize: '14px', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '12px' }}>
              {item.overview ||
                'Available on local storage. Click Play to stream instantly in custom high-definition player or open in external media player.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }}>
              <Folder size={14} />
              <span style={{ wordBreak: 'break-all' }}>{item.folderPath}</span>
            </div>
          </div>

          {/* Series Episodes Section */}
          {isSeries && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #333',
                  paddingBottom: '12px',
                  marginBottom: '16px'
                }}
              >
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Episodes</h3>

                {/* Season Dropdown */}
                {seasonsList.length > 1 && (
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    style={{
                      background: '#242424',
                      color: '#fff',
                      border: '1px solid #444',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '14px',
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
                )}
              </div>

              {/* Episodes List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {episodes.map((ep) => {
                  const epProg = progressMap[ep.filePath];
                  const isCurrent = Boolean(
                    currentEpFilePath && ep.filePath && currentEpFilePath.toLowerCase() === ep.filePath.toLowerCase()
                  );

                  return (
                    <div
                      key={ep.filePath || `${ep.season}-${ep.episode}` || ep.id}
                      onClick={() => onPlayEpisode(item, ep)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px',
                        borderRadius: '6px',
                        background: isCurrent ? 'rgba(229, 9, 20, 0.18)' : '#000000',
                        border: isCurrent ? '1px solid #e50914' : '1px solid #1a1a1a',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isCurrent ? 'rgba(229, 9, 20, 0.28)' : '#141414')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isCurrent ? 'rgba(229, 9, 20, 0.18)' : '#000000')}
                    >
                      {/* Episode Thumbnail */}
                      <EpisodeThumbnail ep={ep} fallbackUrl={backdropUrl} />

                      {/* Episode Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
                            {ep.episode ? `Episode ${ep.episode}` : ep.title}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {ep.duration && (
                              <span style={{ fontSize: '12px', color: '#999' }}>{Math.round(ep.duration / 60)}m</span>
                            )}
                            {ep.resolution && (
                              <span style={{ fontSize: '11px', color: '#888', border: '1px solid #444', padding: '0 4px', borderRadius: '2px' }}>
                                {ep.resolution}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actual official episode name from Internet */}
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: ep.overview ? '4px' : '0' }}>
                          {ep.episodeTitle || (ep.title && !ep.title.startsWith('Episode') ? ep.title : null) || ''}
                        </div>

                        {/* Episode synopsis/overview */}
                        {ep.overview && (
                          <p
                            style={{
                              fontSize: '12px',
                              color: '#999',
                              lineHeight: '1.4',
                              margin: 0,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {ep.overview}
                          </p>
                        )}

                        {epProg && epProg.percentage > 0 && (
                          <div style={{ marginTop: '8px', height: '3px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${epProg.percentage}%`, height: '100%', background: '#e50914' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
