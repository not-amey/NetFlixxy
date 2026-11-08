import React, { useState, useMemo } from 'react';
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
import { MediaItem, SeriesItem, EpisodeItem } from './types/media';
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
    settings,
    scanning,
    scanStatus,
    loading,
    rescan,
    updateProgress,
    saveSettings
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<'home' | 'series' | 'movies' | 'anime'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
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
  }, [library, progressMap]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const movieMatches = library.movies.filter((m) => m.title.toLowerCase().includes(q));
    const seriesMatches = library.series.filter((s) => s.title.toLowerCase().includes(q));
    const animeMatches = (library.anime || []).filter((a) => a.title.toLowerCase().includes(q));
    return [...movieMatches, ...seriesMatches, ...animeMatches];
  }, [library, searchQuery]);

  // Play Actions
  const handlePlayMedia = (item: MediaItem, episode?: EpisodeItem) => {
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
        onRescan={rescan}
        scanning={scanning}
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
            {searchResults.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                progress={item.type === 'movie' ? progressMap[(item as any).filePath] : null}
                onSelect={(selected) => setSelectedItem(selected)}
                onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
              />
            ))}
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
                onSelect={(item) => setSelectedItem(item)}
                onPlayDirect={(item) => handlePlayMedia(item)}
              />
            )}

            <MediaRow
              title="Movies"
              items={library.movies}
              progressMap={progressMap}
              onSelect={(item) => setSelectedItem(item)}
              onPlayDirect={(item) => handlePlayMedia(item)}
            />

            <MediaRow
              title="TV Shows"
              items={library.series}
              progressMap={progressMap}
              onSelect={(item) => setSelectedItem(item)}
              onPlayDirect={(item) => handlePlayMedia(item)}
            />

            {library.anime && library.anime.length > 0 && (
              <MediaRow
                title="Anime"
                items={library.anime}
                progressMap={progressMap}
                onSelect={(item) => setSelectedItem(item)}
                onPlayDirect={(item) => handlePlayMedia(item)}
              />
            )}
          </div>
        </>
      ) : activeTab === 'movies' ? (
        // Movies Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Movies</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {library.movies.map((m) => (
              <MediaCard
                key={m.id}
                item={m}
                progress={progressMap[m.filePath]}
                onSelect={(selected) => setSelectedItem(selected)}
                onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
              />
            ))}
          </div>
        </div>
      ) : activeTab === 'series' ? (
        // TV Shows Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>TV Shows</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {library.series.map((s) => (
              <MediaCard
                key={s.id}
                item={s}
                onSelect={(selected) => setSelectedItem(selected)}
                onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
              />
            ))}
          </div>
        </div>
      ) : (
        // Anime Tab
        <div style={{ paddingTop: '100px', paddingLeft: '50px', paddingRight: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Anime</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
            {(library.anime || []).map((a) => (
              <MediaCard
                key={a.id}
                item={a}
                onSelect={(selected) => setSelectedItem(selected)}
                onPlayDirect={(toPlay) => handlePlayMedia(toPlay)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          progressMap={progressMap}
          onClose={() => setSelectedItem(null)}
          onPlayEpisode={(item, ep) => {
            setSelectedItem(null);
            handlePlayMedia(item, ep);
          }}
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
              rescan();
            }}
          />
        </SettingsErrorBoundary>
      )}
    </div>
  );
}
