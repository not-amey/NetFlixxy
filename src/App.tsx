import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from './hooks/useLibrary';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MediaRow } from './components/MediaRow';
import { MediaCard } from './components/MediaCard';
import { DetailModal } from './components/DetailModal';
import { Player } from './components/Player';
import { MiniPlayer } from './components/MiniPlayer';
import { SettingsModal } from './components/SettingsModal';
import { SettingsErrorBoundary } from './components/ErrorBoundary';
import { NetflixNIcon } from './components/NetflixLogo';
import { WatchedSection } from './components/WatchedSection';
import { RatingModal } from './components/RatingModal';
import { MediaItem, SeriesItem, EpisodeItem, WatchedShowItem } from './types/media';
import { getSeriesResumeEpisode, getAllSeriesEpisodes } from './utils/progress';

export default function App() {
  // Check if loaded into mini player window
  const isMiniRoute = typeof window !== 'undefined' && window.location.hash.includes('mini');
  if (isMiniRoute) {
    return <MiniPlayer />;
  }

  const {
    library,
    progressMap,
    watchedShows,
    settings,
    scanning,
    scanStatus,
    loading,
    rescan,
    scanNewShows,
    updateProgress,
    markShowAsWatched,
    setWatchedRating,
    removeWatchedShow,
    saveSettings
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<'home' | 'series' | 'movies' | 'anime' | 'watched'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [ratingModalItem, setRatingModalItem] = useState<MediaItem | WatchedShowItem | null>(null);
  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<EpisodeItem | null>(null);
  const [startFromBeginning, setStartFromBeginning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Featured Hero Items for Slider (mix top movies, series, and anime)
  const featuredItems = useMemo(() => {
    const list: MediaItem[] = [];
    const movies = [...library.movies];
    const series = [...library.series];
    const anime = [...(library.anime || [])];
    while (list.length < 5 && (movies.length > 0 || series.length > 0 || anime.length > 0)) {
      if (movies.length > 0) list.push(movies.shift()!);
      if (series.length > 0 && list.length < 5) list.push(series.shift()!);
      if (anime.length > 0 && list.length < 5) list.push(anime.shift()!);
    }
    return list;
  }, [library]);

  // "Continue Watching" list
  const continueWatchingItems = useMemo(() => {
    const list: { item: MediaItem; updatedAt: number }[] = [];
    const seenIds = new Set<string>();

    // Check movies
    library.movies.forEach((m) => {
      const p = progressMap[m.filePath];
      const isCompleted =
        p?.completed ||
        (p && p.percentage >= 95) ||
        (p && p.duration > 0 && p.currentTime / p.duration >= 0.95);
      if (p && !isCompleted && (p.percentage > 1 || p.currentTime > 5) && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        list.push({ item: m, updatedAt: p.updatedAt || 0 });
      }
    });

    // Check series & anime: query progress table for series' most recently updated episode
    const allShows = [...library.series, ...(library.anime || [])];
    allShows.forEach((s) => {
      if (seenIds.has(s.id)) return;
      // If series is already in Watched vault, do not show in Continue Watching
      const isAlreadyWatched = watchedShows.some(
        (w) => w.id === s.id || (w.title && w.title.toLowerCase() === s.title.toLowerCase())
      );
      if (isAlreadyWatched) return;

      const resumeInfo = getSeriesResumeEpisode(s, progressMap);
      if (resumeInfo.lastUpdatedAt > 0 && resumeInfo.episode) {
        // If series is completely finished (last episode >= 95%), don't show in continue watching
        const allEps = getAllSeriesEpisodes(s);
        const lastEp = allEps[allEps.length - 1];
        const isFinalEp = lastEp && resumeInfo.episode.filePath === lastEp.filePath;
        const isCompleted =
          resumeInfo.progress?.completed ||
          (resumeInfo.progress && resumeInfo.progress.percentage >= 95) ||
          (resumeInfo.progress &&
            resumeInfo.progress.duration > 0 &&
            resumeInfo.progress.currentTime / resumeInfo.progress.duration >= 0.95);
        if (isFinalEp && isCompleted) {
          return;
        }

        seenIds.add(s.id);
        list.push({ item: s, updatedAt: resumeInfo.lastUpdatedAt });
      }
    });

    // Sort most recently watched first
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list.map((l) => l.item);
  }, [library, progressMap, watchedShows]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const movieMatches = library.movies.filter((m) => m.title.toLowerCase().includes(q));
    const seriesMatches = library.series.filter((s) => s.title.toLowerCase().includes(q));
    const animeMatches = (library.anime || []).filter((a) => a.title.toLowerCase().includes(q));
    return [...movieMatches, ...seriesMatches, ...animeMatches];
  }, [library, searchQuery]);

  // Update Discord presence when browsing library
  useEffect(() => {
    if (!playingItem) {
      const moviesCount = library.movies?.length || 0;
      const seriesCount = (library.series?.length || 0) + (library.anime?.length || 0);
      (window as any).electronAPI?.setDiscordBrowsing?.({
        movies: moviesCount,
        series: seriesCount
      });
    }
  }, [playingItem, library]);

  // Play Actions
  const handlePlayMedia = (item: MediaItem, episode?: EpisodeItem) => {
    if (settings?.openInExternalPlayer) {
      const targetPath = item.type === 'series'
        ? (episode ? episode.filePath : getSeriesResumeEpisode(item as SeriesItem, progressMap).episode?.filePath)
        : (item as any).filePath;
      if (targetPath) {
        (window as any).electronAPI?.openInExternalPlayer(targetPath);
        return;
      }
    }

    setPlayingItem(item);
    if (item.type === 'series') {
      if (episode) {
        setStartFromBeginning(false);
        setPlayingEpisode(episode);
      } else {
        const resumeInfo = getSeriesResumeEpisode(item as SeriesItem, progressMap);
        setStartFromBeginning(resumeInfo.isNextEpisode);
        setPlayingEpisode(resumeInfo.episode);
      }
    } else {
      setStartFromBeginning(false);
      setPlayingEpisode(null);
    }
  };

  const handlePlayWatched = (watchedItem: WatchedShowItem) => {
    // Check if it's a movie
    if (watchedItem.type === 'movie') {
      const foundMovie = library.movies.find(
        (m) => m.id === watchedItem.id || (m.title && m.title.toLowerCase() === watchedItem.title.toLowerCase())
      );
      if (foundMovie) {
        handlePlayMedia(foundMovie);
        return;
      }
    }

    // Check series & anime
    const allShows = [...library.series, ...(library.anime || [])];
    const foundShow = allShows.find(
      (s) => s.id === watchedItem.id || (s.title && s.title.toLowerCase() === watchedItem.title.toLowerCase())
    );
    if (foundShow) {
      handlePlayMedia(foundShow);
      return;
    }

    // Fallback: check movies if not typed
    const foundMovieFallback = library.movies.find(
      (m) => m.id === watchedItem.id || (m.title && m.title.toLowerCase() === watchedItem.title.toLowerCase())
    );
    if (foundMovieFallback) {
      handlePlayMedia(foundMovieFallback);
      return;
    }

    alert(`"${watchedItem.title}" files were removed from disk, but its banner and your rating (${watchedItem.rating ? watchedItem.rating + '/10' : 'Watched'}) are permanently kept in your Watched vault.`);
  };

  const handleSelectWatched = (watchedItem: WatchedShowItem) => {
    // Check movies first if movie type
    if (watchedItem.type === 'movie') {
      const foundMovie = library.movies.find(
        (m) => m.id === watchedItem.id || (m.title && m.title.toLowerCase() === watchedItem.title.toLowerCase())
      );
      if (foundMovie) {
        setSelectedItem(foundMovie);
        return;
      }
    }

    const allShows = [...library.series, ...(library.anime || [])];
    const foundShow = allShows.find(
      (s) => s.id === watchedItem.id || (s.title && s.title.toLowerCase() === watchedItem.title.toLowerCase())
    );
    if (foundShow) {
      setSelectedItem(foundShow);
      return;
    }

    const foundMovieFallback = library.movies.find(
      (m) => m.id === watchedItem.id || (m.title && m.title.toLowerCase() === watchedItem.title.toLowerCase())
    );
    if (foundMovieFallback) {
      setSelectedItem(foundMovieFallback);
      return;
    }

    setRatingModalItem(watchedItem);
  };

  const handleSaveRating = (rating: number | null) => {
    if (!ratingModalItem) return;
    const isAlreadyInWatched = watchedShows.some(
      (w) => w.id === ratingModalItem.id || (w.title && w.title.toLowerCase() === ratingModalItem.title?.toLowerCase())
    );
    if (isAlreadyInWatched) {
      setWatchedRating(ratingModalItem.id, rating);
    } else {
      markShowAsWatched(ratingModalItem as any, rating);
    }
  };

  // Next Episode handler for TV Shows
  const handleNextEpisode = () => {
    if (!playingItem || playingItem.type !== 'series' || !playingEpisode) return;
    const series = playingItem as any;
    const curSeason = playingEpisode.season;
    const curEpNum = playingEpisode.episode;
    const currentSeasonEps = series.seasons[curSeason] || [];

    // Next in same season
    const nextInSeason = currentSeasonEps.find((e: EpisodeItem) => e.episode === curEpNum + 1);
    if (nextInSeason) {
      setStartFromBeginning(true);
      setPlayingEpisode(nextInSeason);
      return;
    }

    // First in next season
    const nextSeasonNum = curSeason + 1;
    if (series.seasons[nextSeasonNum] && series.seasons[nextSeasonNum].length > 0) {
      setStartFromBeginning(true);
      setPlayingEpisode(series.seasons[nextSeasonNum][0]);
    }
  };

  const hasNextEpisode = useMemo(() => {
    if (!playingItem || playingItem.type !== 'series' || !playingEpisode) return false;
    const series = playingItem as any;
    const curSeason = playingEpisode.season;
    const curEpNum = playingEpisode.episode;
    const currentSeasonEps = series.seasons[curSeason] || [];
    if (currentSeasonEps.some((e: EpisodeItem) => e.episode === curEpNum + 1)) return true;
    return !!(series.seasons[curSeason + 1] && series.seasons[curSeason + 1].length > 0);
  }, [playingItem, playingEpisode]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#141414', gap: '16px' }}>
        <NetflixNIcon size={64} className="animate-pulse" />
        <h2 style={{ color: '#e50914', fontSize: '24px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          NETFLIX
        </h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#141414', color: '#fff', position: 'relative' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        watchedCount={watchedShows.length}
      />

      {/* Scan Progress Toast */}
      {scanning && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(20,20,20,0.92)',
            border: '1px solid #e50914',
            padding: '12px 18px',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#fff',
            zIndex: 90,
            maxWidth: '380px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)'
          }}
        >
          <span style={{ fontWeight: 700, color: '#e50914' }}>Scanning Media: </span>
          <span style={{ color: '#ccc', wordBreak: 'break-all' }}>{scanStatus}</span>
        </div>
      )}

      {/* Main Content Area */}
      {searchQuery.trim() ? (
        // Search View
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
            Results for "{searchQuery}" ({searchResults.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {searchResults.map((item) => {
              const matchedWatched = watchedShows.find(
                (w) => w.id === item.id || (w.title && w.title.toLowerCase() === item.title.toLowerCase())
              );
              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  progress={item.type === 'movie' ? progressMap[(item as any).filePath] : null}
                  isWatched={Boolean(matchedWatched)}
                  watchedRating={matchedWatched?.rating ?? null}
                  onSelect={(selected) => setSelectedItem(selected)}
                  onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
                  onMarkWatched={(m) => setRatingModalItem(m)}
                />
              );
            })}
          </div>
        </div>
      ) : activeTab === 'home' ? (
        // Home View with Multi-poster Slider
        <>
          <HeroBanner
            items={featuredItems}
            onPlay={(item) => handlePlayMedia(item)}
            onOpenDetails={(item) => setSelectedItem(item)}
          />

          <div style={{ position: 'relative', marginTop: '-60px', zIndex: 30 }}>
            {continueWatchingItems.length > 0 && (
              <MediaRow
                title="Continue Watching"
                items={continueWatchingItems}
                progressMap={progressMap}
                watchedShows={watchedShows}
                onSelect={(item) => setSelectedItem(item)}
                onPlayDirect={(item) => handlePlayMedia(item)}
                onMarkWatched={(m) => setRatingModalItem(m)}
              />
            )}

            <MediaRow
              title="Movies"
              items={library.movies}
              progressMap={progressMap}
              watchedShows={watchedShows}
              onSelect={(item) => setSelectedItem(item)}
              onPlayDirect={(item) => handlePlayMedia(item)}
              onMarkWatched={(m) => setRatingModalItem(m)}
            />

            <MediaRow
              title="TV Shows"
              items={library.series}
              progressMap={progressMap}
              watchedShows={watchedShows}
              onSelect={(item) => setSelectedItem(item)}
              onPlayDirect={(item) => handlePlayMedia(item)}
              onMarkWatched={(m) => setRatingModalItem(m)}
            />

            {library.anime && library.anime.length > 0 && (
              <MediaRow
                title="Anime"
                items={library.anime}
                progressMap={progressMap}
                watchedShows={watchedShows}
                onSelect={(item) => setSelectedItem(item)}
                onPlayDirect={(item) => handlePlayMedia(item)}
                onMarkWatched={(m) => setRatingModalItem(m)}
              />
            )}
          </div>
        </>
      ) : activeTab === 'movies' ? (
        // Movies Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Movies</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {library.movies.map((m) => {
              const matchedWatched = watchedShows.find(
                (w) => w.id === m.id || (w.title && w.title.toLowerCase() === m.title.toLowerCase())
              );
              return (
                <MediaCard
                  key={m.id}
                  item={m}
                  progress={progressMap[m.filePath]}
                  isWatched={Boolean(matchedWatched)}
                  watchedRating={matchedWatched?.rating ?? null}
                  onSelect={(selected) => setSelectedItem(selected)}
                  onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
                  onMarkWatched={(item) => setRatingModalItem(item)}
                />
              );
            })}
          </div>
        </div>
      ) : activeTab === 'series' ? (
        // TV Shows Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>TV Shows</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {library.series.map((s) => {
              const matchedWatched = watchedShows.find(
                (w) => w.id === s.id || (w.title && w.title.toLowerCase() === s.title.toLowerCase())
              );
              return (
                <MediaCard
                  key={s.id}
                  item={s}
                  isWatched={Boolean(matchedWatched)}
                  watchedRating={matchedWatched?.rating ?? null}
                  onSelect={(selected) => setSelectedItem(selected)}
                  onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
                  onMarkWatched={(m) => setRatingModalItem(m)}
                />
              );
            })}
          </div>
        </div>
      ) : activeTab === 'anime' ? (
        // Anime Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Anime</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {(library.anime || []).map((a) => {
              const matchedWatched = watchedShows.find(
                (w) => w.id === a.id || (w.title && w.title.toLowerCase() === a.title.toLowerCase())
              );
              return (
                <MediaCard
                  key={a.id}
                  item={a}
                  isWatched={Boolean(matchedWatched)}
                  watchedRating={matchedWatched?.rating ?? null}
                  onSelect={(selected) => setSelectedItem(selected)}
                  onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
                  onMarkWatched={(m) => setRatingModalItem(m)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        // Dedicated Watched Tab
        <WatchedSection
          items={watchedShows}
          libraryShows={[...library.movies, ...library.series, ...(library.anime || [])]}
          onSelectWatched={handleSelectWatched}
          onPlayWatched={handlePlayWatched}
          onRateShow={(w) => setRatingModalItem(w)}
          onRemoveWatched={removeWatchedShow}
        />
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          progressMap={progressMap}
          isWatched={watchedShows.some(
            (w) => w.id === selectedItem.id || (w.title && w.title.toLowerCase() === selectedItem.title.toLowerCase())
          )}
          watchedRating={
            watchedShows.find(
              (w) => w.id === selectedItem.id || (w.title && w.title.toLowerCase() === selectedItem.title.toLowerCase())
            )?.rating ?? null
          }
          onClose={() => setSelectedItem(null)}
          onPlayEpisode={(item, ep) => {
            setSelectedItem(null);
            handlePlayMedia(item, ep);
          }}
          onMarkWatched={(item) => setRatingModalItem(item)}
        />
      )}

      {/* Rating & Mark as Watched Modal */}
      {ratingModalItem && (
        <RatingModal
          item={ratingModalItem}
          isWatched={watchedShows.some(
            (w) => w.id === ratingModalItem.id || (w.title && w.title.toLowerCase() === ratingModalItem.title?.toLowerCase())
          )}
          currentRating={
            watchedShows.find(
              (w) => w.id === ratingModalItem.id || (w.title && w.title.toLowerCase() === ratingModalItem.title?.toLowerCase())
            )?.rating ?? (ratingModalItem as any).rating ?? null
          }
          onSaveRating={handleSaveRating}
          onRemoveWatched={() => removeWatchedShow(ratingModalItem.id)}
          onClose={() => setRatingModalItem(null)}
        />
      )}

      {/* Fullscreen Video Player */}
      {playingItem && (
        <SettingsErrorBoundary onClose={() => {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          setPlayingItem(null);
          setPlayingEpisode(null);
          setStartFromBeginning(false);
        }}>
          <Player
            item={playingItem}
            episode={playingEpisode}
            progressMap={progressMap}
            progress={
              startFromBeginning
                ? null
                : playingEpisode
                  ? progressMap[playingEpisode.filePath]
                  : progressMap[(playingItem as any).filePath]
            }
            onClose={() => {
              document.body.style.overflow = '';
              document.documentElement.style.overflow = '';
              setPlayingItem(null);
              setPlayingEpisode(null);
              setStartFromBeginning(false);
            }}
            onUpdateProgress={updateProgress}
            onNextEpisode={handleNextEpisode}
            onSelectEpisode={(ep) => {
              setStartFromBeginning(false);
              setPlayingEpisode(ep);
            }}
            hasNextEpisode={hasNextEpisode}
            isSettingsOpen={isSettingsOpen}
            onOpenMiniPlayer={(curTime, isPlayingState) => {
              const currentFilePath = playingEpisode ? playingEpisode.filePath : (playingItem as any).filePath;
              (window as any).electronAPI?.openMiniPlayer({
                filePath: currentFilePath,
                currentTime: curTime,
                isPlaying: isPlayingState,
                item: playingItem,
                episode: playingEpisode
              });
            }}
          />
        </SettingsErrorBoundary>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsErrorBoundary onClose={() => setIsSettingsOpen(false)}>
          <SettingsModal
            settings={settings}
            onClose={() => setIsSettingsOpen(false)}
            onSave={(newSettings) => {
              saveSettings(newSettings);
            }}
            onRescanCurrent={() => rescan({ type: 'all' })}
            onScanNewShows={scanNewShows}
            scanning={scanning}
            scanStatus={scanStatus}
          />
        </SettingsErrorBoundary>
      )}
    </div>
  );
}
