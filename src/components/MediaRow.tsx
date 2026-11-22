import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from './MediaCard';
import { MediaItem, SeriesItem, WatchProgress, WatchedShowItem } from '../types/media';
import { getSeriesResumeEpisode } from '../utils/progress';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  progressMap: Record<string, WatchProgress>;
  watchedShows?: WatchedShowItem[];
  onSelect: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
  onMarkWatched?: (item: MediaItem) => void;
}

export const MediaRow: React.FC<MediaRowProps> = ({
  title,
  items,
  progressMap,
  watchedShows = [],
  onSelect,
  onPlayDirect,
  onMarkWatched
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -650 : 650;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="row-wrapper" style={{ position: 'relative', marginBottom: '36px', padding: '0 50px' }}>
      {/* Row Header */}
      <h3
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#e5e5e5',
          marginBottom: '8px',
          letterSpacing: '-0.01em'
        }}
      >
        {title}
      </h3>

      {/* Left Scroll Button */}
      <button
        className="carousel-btn left"
        onClick={() => scroll('left')}
        aria-label="Scroll left"
      >
        <ChevronLeft size={32} />
      </button>

      {/* Cards Container */}
      <div className="row-scroll-container" ref={scrollContainerRef}>
        {items.map((item) => {
          let prog: WatchProgress | null = null;
          if (item.type === 'movie') {
            prog = progressMap[(item as any).filePath] || null;
          } else if (item.type === 'series') {
            const resumeInfo = getSeriesResumeEpisode(item as SeriesItem, progressMap);
            prog = resumeInfo.progress;
          }

          const watchedMatch = watchedShows.find(
            (w) => w.id === item.id || (w.title && w.title.toLowerCase() === item.title.toLowerCase())
          );
          const isWatched = Boolean(watchedMatch);
          const watchedRating = watchedMatch ? watchedMatch.rating : null;

          return (
            <MediaCard
              key={item.id}
              item={item}
              progress={prog}
              isWatched={isWatched}
              watchedRating={watchedRating}
              onSelect={onSelect}
              onPlayDirect={onPlayDirect}
              onMarkWatched={onMarkWatched}
            />
          );
        })}
      </div>

      {/* Right Scroll Button */}
      <button
        className="carousel-btn right"
        onClick={() => scroll('right')}
        aria-label="Scroll right"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
};
