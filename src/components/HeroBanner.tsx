import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types/media';
import { NetflixBadge } from './NetflixLogo';

interface HeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items, onPlay, onOpenDetails }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const featuredList = items.slice(0, 5);

  // Auto-advance slider every 6.5 seconds when not hovered
  useEffect(() => {
    if (featuredList.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (!isHovered) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % featuredList.length);
      }, 6500);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [featuredList.length, isHovered]);

  if (featuredList.length === 0) {
    return (
      <div
        style={{
          height: '65vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1f1f1f 0%, #141414 100%)'
        }}
      >
        <p style={{ color: '#888', fontSize: '18px' }}>No media found in library. Click Rescan to begin.</p>
      </div>
    );
  }

  const currentItem = featuredList[currentIndex] || featuredList[0];
  const isSeries = currentItem.type === 'series';

  // Best banner path: backdrop -> poster -> movie video file -> first episode video file
  let bannerPath: string | null = currentItem.backdrop || currentItem.poster || null;
  if (!bannerPath) {
    if (currentItem.type === 'movie' && currentItem.filePath) {
      bannerPath = currentItem.filePath;
    } else if (currentItem.type === 'series' && currentItem.seasons) {
      const firstSeason = Object.values(currentItem.seasons)[0];
      if (firstSeason && firstSeason.length > 0 && firstSeason[0].filePath) {
        bannerPath = firstSeason[0].filePath;
      }
    }
  }

  const backdropUrl =
    bannerPath && (window as any).electronAPI
      ? (window as any).electronAPI.getThumbUrl(bannerPath)
      : null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % featuredList.length);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        height: '76vh',
        minHeight: '540px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '56px',
        paddingRight: '56px',
        overflow: 'hidden',
        background: backdropUrl
          ? `linear-gradient(to right, rgba(20,20,20,0.95) 25%, rgba(20,20,20,0.6) 65%, rgba(20,20,20,0.85) 100%), url('${backdropUrl}') center/cover no-repeat`
          : 'linear-gradient(135deg, #381216 0%, #1c1415 50%, #141414 100%)',
        transition: 'background 0.6s ease'
      }}
    >
      {/* Bottom Gradient Vignette */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '200px',
          background: 'linear-gradient(180deg, transparent 0%, #141414 100%)',
          pointerEvents: 'none'
        }}
      />

      {/* Left Navigation Arrow */}
      {featuredList.length > 1 && (
        <button
          onClick={handlePrev}
          title="Previous Featured"
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            zIndex: 30,
            opacity: isHovered ? 1 : 0.4,
            transition: 'opacity 0.2s, background 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(229, 9, 20, 0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Right Navigation Arrow */}
      {featuredList.length > 1 && (
        <button
          onClick={handleNext}
          title="Next Featured"
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            zIndex: 30,
            opacity: isHovered ? 1 : 0.4,
            transition: 'opacity 0.2s, background 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(229, 9, 20, 0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Content Area */}
      <div style={{ maxWidth: '680px', zIndex: 10 }}>
        {/* Netflix Emblem & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <NetflixBadge size={14} />

          <span
            style={{
              background: '#e50914',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            {isSeries ? 'Series' : 'Movie'}
          </span>

          {currentItem.year && (
            <span style={{ color: '#bbb', fontSize: '14px', fontWeight: 600 }}>{currentItem.year}</span>
          )}

          {!isSeries && (currentItem as any).resolution && (
            <span
              style={{
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '3px',
                padding: '1px 6px',
                fontSize: '11px',
                color: '#ddd'
              }}
            >
              {(currentItem as any).resolution}
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          className="brand-font"
          style={{
            fontSize: '52px',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: '16px',
            textShadow: '0 4px 20px rgba(0,0,0,0.85)'
          }}
        >
          {currentItem.title}
        </h1>

        {/* Overview */}
        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.55,
            color: '#d2d2d2',
            marginBottom: '26px',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {currentItem.overview ||
            (isSeries
              ? `Watch all ${Object.keys((currentItem as any).seasons || {}).length} season(s) offline. Local high-definition library copy.`
              : 'Offline feature film stored on your local drive with instant playback and resume.')}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => onPlay(currentItem)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              color: '#141414',
              border: 'none',
              padding: '12px 32px',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.75)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
          >
            <Play size={22} fill="#141414" />
            <span>Play</span>
          </button>

          <button
            onClick={() => onOpenDetails(currentItem)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(109, 109, 110, 0.7)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 26px',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(109, 109, 110, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(109, 109, 110, 0.7)')}
          >
            <Info size={22} />
            <span>More Info</span>
          </button>
        </div>
      </div>

      {/* Slide Indicator Pills / Dots */}
      {featuredList.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '56px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 25
          }}
        >
          {featuredList.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                title={item.title}
                style={{
                  width: isActive ? '28px' : '10px',
                  height: '4px',
                  borderRadius: '2px',
                  background: isActive ? '#e50914' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
