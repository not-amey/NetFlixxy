/**
 * Plain HTML, CSS, and JavaScript templates for Phone Streaming Mode.
 * Completely offline, dark theme (#141414) with Netflix red accent (#e50914).
 * Zero external CDN dependencies.
 */

export function renderLibraryHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#141414">
  <title>NetFlixxy • Home Wi-Fi Streaming</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: #141414;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding-bottom: 60px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(20, 20, 20, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 14px 16px;
      border-bottom: 1px solid #282828;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo {
      color: #e50914;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .wifi-badge {
      font-size: 11px;
      background: rgba(229, 9, 20, 0.18);
      color: #e50914;
      border: 1px solid rgba(229, 9, 20, 0.4);
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .search-box {
      width: 100%;
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 10px 14px 10px 36px;
      background: #232323;
      border: 1px solid #383838;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: #e50914;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #888;
      font-size: 14px;
      pointer-events: none;
    }
    .filter-tabs {
      display: flex;
      gap: 8px;
      padding: 12px 16px 4px 16px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .filter-tabs::-webkit-scrollbar { display: none; }
    .tab-btn {
      background: #222;
      border: 1px solid #333;
      color: #bbb;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: #e50914;
      border-color: #e50914;
      color: #fff;
    }
    .content-container {
      padding: 12px 16px;
    }
    .stats-bar {
      font-size: 12px;
      color: #888;
      margin-bottom: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 14px 10px;
    }
    @media (min-width: 600px) {
      .grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 18px 14px;
      }
    }
    .card {
      background: #1c1c1c;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    .card:active {
      transform: scale(0.97);
    }
    .card-thumb-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 2 / 3;
      background: #2a2a2a;
      overflow: hidden;
    }
    .card-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .card-thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 28px;
      background: #252525;
    }
    .badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge.movie { border-left: 2px solid #e50914; }
    .badge.series { border-left: 2px solid #00a8e8; }
    .badge.anime { border-left: 2px solid #ff9900; }
    .progress-bar-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.2);
    }
    .progress-bar-fill {
      height: 100%;
      background: #e50914;
    }
    .card-info {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta {
      font-size: 11px;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #777;
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    /* Episode Drawer / Modal */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 200;
      display: none;
      align-items: flex-end;
      backdrop-filter: blur(5px);
    }
    .drawer-overlay.active {
      display: flex;
    }
    .drawer-panel {
      background: #181818;
      width: 100%;
      max-height: 85vh;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.8);
      animation: slideUp 0.25s ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .drawer-header {
      padding: 16px;
      border-bottom: 1px solid #282828;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-title-wrap {
      flex: 1;
      padding-right: 12px;
    }
    .drawer-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .drawer-subtitle {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }
    .drawer-close {
      background: #2a2a2a;
      border: none;
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .season-selector {
      display: flex;
      gap: 8px;
      padding: 10px 16px;
      overflow-x: auto;
      border-bottom: 1px solid #242424;
      background: #141414;
    }
    .season-btn {
      background: #222;
      border: 1px solid #333;
      color: #aaa;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    .season-btn.active {
      background: #e50914;
      border-color: #e50914;
      color: #fff;
    }
    .episodes-list {
      padding: 12px 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .episode-card {
      display: flex;
      gap: 12px;
      background: #202020;
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      align-items: center;
      transition: background 0.15s;
    }
    .episode-card:active {
      background: #2c2c2c;
    }
    .ep-thumb-wrap {
      width: 90px;
      height: 54px;
      border-radius: 6px;
      background: #282828;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .ep-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ep-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: rgba(255,255,255,0.2);
    }
    .ep-progress-fill {
      height: 100%;
      background: #e50914;
    }
    .ep-info {
      flex: 1;
      overflow: hidden;
    }
    .ep-num {
      font-size: 11px;
      color: #e50914;
      font-weight: 700;
    }
    .ep-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 2px 0;
    }
    .ep-meta {
      font-size: 11px;
      color: #888;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <div class="brand">
        <span class="logo">NetFlixxy</span>
        <span class="wifi-badge">Wi-Fi Streaming</span>
      </div>
    </div>
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input type="search" id="searchInput" class="search-input" placeholder="Search movies, series, episodes..." autocomplete="off">
    </div>
  </header>

  <div class="filter-tabs">
    <button class="tab-btn active" data-filter="all">All</button>
    <button class="tab-btn" data-filter="movies">Movies</button>
    <button class="tab-btn" data-filter="series">Series</button>
    <button class="tab-btn" data-filter="anime">Anime</button>
  </div>

  <div class="content-container">
    <div class="stats-bar" id="statsBar">Loading library...</div>
    <div class="grid" id="mediaGrid"></div>
    <div class="empty-state" id="emptyState" style="display: none;">
      <div class="empty-icon">🎬</div>
      <div style="font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px;">No titles found</div>
      <div style="font-size: 13px;">Try searching for a different word</div>
    </div>
  </div>

  <!-- Series Episode Modal / Drawer -->
  <div class="drawer-overlay" id="drawerOverlay">
    <div class="drawer-panel">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <div class="drawer-title" id="drawerTitle">Series Title</div>
          <div class="drawer-subtitle" id="drawerSubtitle">Seasons & Episodes</div>
        </div>
        <button class="drawer-close" id="drawerClose">&times;</button>
      </div>
      <div class="season-selector" id="seasonSelector"></div>
      <div class="episodes-list" id="episodesList"></div>
    </div>
  </div>

  <script>
    let libraryData = { movies: [], series: [], anime: [] };
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedSeries = null;
    let selectedSeason = null;

    function formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';
      const s = Math.floor(seconds);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) {
        return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }
      return m + ':' + String(s % 60).padStart(2, '0');
    }

    async function loadLibrary() {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        libraryData = await res.json();
        render();
      } catch (e) {
        document.getElementById('statsBar').textContent = 'Error loading library: ' + e.message;
      }
    }

    function getFilteredItems() {
      let items = [];
      if (currentFilter === 'all' || currentFilter === 'movies') {
        items = items.concat(libraryData.movies || []);
      }
      if (currentFilter === 'all' || currentFilter === 'series') {
        items = items.concat(libraryData.series || []);
      }
      if (currentFilter === 'all' || currentFilter === 'anime') {
        items = items.concat(libraryData.anime || []);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        items = items.filter(it => {
          if (it.title && it.title.toLowerCase().includes(q)) return true;
          if (it.year && String(it.year).includes(q)) return true;
          // Search in episodes if series
          if (it.seasons) {
            for (const s of Object.values(it.seasons)) {
              if (Array.isArray(s) && s.some(ep => ep.title && ep.title.toLowerCase().includes(q))) return true;
            }
          }
          return false;
        });
      }
      return items;
    }

    function render() {
      const items = getFilteredItems();
      const grid = document.getElementById('mediaGrid');
      const empty = document.getElementById('emptyState');
      const stats = document.getElementById('statsBar');

      stats.textContent = items.length + ' title' + (items.length === 1 ? '' : 's');

      if (items.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
      }

      empty.style.display = 'none';
      grid.innerHTML = items.map(item => {
        const isSeries = item.type === 'series';
        const typeClass = item.category === 'anime' ? 'anime' : (isSeries ? 'series' : 'movie');
        const typeLabel = item.category === 'anime' ? 'Anime' : (isSeries ? 'Series' : 'Movie');

        let thumbSrc = '';
        if (item.poster) {
          thumbSrc = '/thumb?file=' + encodeURIComponent(item.poster);
        } else if (item.filePath) {
          thumbSrc = '/thumb?file=' + encodeURIComponent(item.filePath);
        }

        let progressHtml = '';
        if (item.progress && item.progress.duration > 0 && item.progress.currentTime > 0) {
          const pct = Math.min(100, Math.round((item.progress.currentTime / item.progress.duration) * 100));
          progressHtml = '<div class="progress-bar-container"><div class="progress-bar-fill" style="width: ' + pct + '%;"></div></div>';
        }

        return '<div class="card" onclick="handleItemClick(\\'' + item.id + '\\')">' +
          '<div class="card-thumb-wrap">' +
            (thumbSrc ? '<img class="card-thumb" src="' + thumbSrc + '" loading="lazy" onerror="this.style.display=\\'none\\';this.nextElementSibling.style.display=\\'flex\\';">' : '') +
            '<div class="card-thumb-placeholder" style="' + (thumbSrc ? 'display:none;' : '') + '">🎬</div>' +
            '<span class="badge ' + typeClass + '">' + typeLabel + '</span>' +
            progressHtml +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-title">' + (item.title || 'Untitled') + '</div>' +
            '<div class="card-meta">' +
              '<span>' + (item.year || '') + '</span>' +
              (isSeries ? '<span>' + Object.keys(item.seasons || {}).length + ' S</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function findItemById(id) {
      const all = [...(libraryData.movies || []), ...(libraryData.series || []), ...(libraryData.anime || [])];
      for (const it of all) {
        if (it.id === id) return it;
        if (it.seasons) {
          for (const s of Object.values(it.seasons)) {
            if (Array.isArray(s)) {
              const ep = s.find(e => e.id === id);
              if (ep) return ep;
            }
          }
        }
      }
      return null;
    }

    window.handleItemClick = function(id) {
      const item = findItemById(id);
      if (!item) return;

      if (item.type === 'series') {
        openSeriesDrawer(item);
      } else {
        window.location.href = '/watch/' + encodeURIComponent(item.id);
      }
    };

    function openSeriesDrawer(series) {
      selectedSeries = series;
      const seasons = Object.keys(series.seasons || {}).sort((a,b) => parseInt(a)-parseInt(b));
      selectedSeason = seasons[0] || '1';

      document.getElementById('drawerTitle').textContent = series.title;
      document.getElementById('drawerSubtitle').textContent = seasons.length + ' Season' + (seasons.length === 1 ? '' : 's');

      const selector = document.getElementById('seasonSelector');
      selector.innerHTML = seasons.map(s =>
        '<button class="season-btn ' + (s === selectedSeason ? 'active' : '') + '" onclick="selectSeason(\\'' + s + '\\')">Season ' + s + '</button>'
      ).join('');

      renderEpisodeList();
      document.getElementById('drawerOverlay').classList.add('active');
    }

    window.selectSeason = function(s) {
      selectedSeason = s;
      document.querySelectorAll('.season-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes('Season ' + s));
      });
      renderEpisodeList();
    };

    function renderEpisodeList() {
      if (!selectedSeries || !selectedSeason) return;
      const episodes = (selectedSeries.seasons && selectedSeries.seasons[selectedSeason]) || [];
      const list = document.getElementById('episodesList');

      if (episodes.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No episodes found</div>';
        return;
      }

      list.innerHTML = episodes.map(ep => {
        let epThumb = '';
        if (ep.poster) {
          epThumb = '/thumb?file=' + encodeURIComponent(ep.poster);
        } else if (ep.filePath) {
          epThumb = '/thumb?file=' + encodeURIComponent(ep.filePath);
        }

        let progressHtml = '';
        let timeLabel = '';
        if (ep.progress && ep.progress.duration > 0 && ep.progress.currentTime > 0) {
          const pct = Math.min(100, Math.round((ep.progress.currentTime / ep.progress.duration) * 100));
          progressHtml = '<div class="ep-progress-bar"><div class="ep-progress-fill" style="width: ' + pct + '%;"></div></div>';
          timeLabel = ep.progress.completed ? '✓ Completed' : formatTime(ep.progress.currentTime) + ' / ' + formatTime(ep.progress.duration);
        }

        return '<div class="episode-card" onclick="window.location.href=\\'/watch/' + encodeURIComponent(ep.id) + '\\'">' +
          '<div class="ep-thumb-wrap">' +
            (epThumb ? '<img class="ep-thumb" src="' + epThumb + '" loading="lazy" onerror="this.style.display=\\'none\\';">' : '') +
            progressHtml +
          '</div>' +
          '<div class="ep-info">' +
            '<div class="ep-num">E' + (ep.episode || '') + '</div>' +
            '<div class="ep-title">' + (ep.title || 'Episode ' + (ep.episode || '')) + '</div>' +
            (timeLabel ? '<div class="ep-meta">' + timeLabel + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    document.getElementById('drawerClose').onclick = function() {
      document.getElementById('drawerOverlay').classList.remove('active');
    };
    document.getElementById('drawerOverlay').onclick = function(e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    };

    // Filter tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
      });
    });

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    loadLibrary();
  </script>
</body>
</html>`;
}

export function renderPlayerHtml(mediaItem, initialProgress = 0, isDirectPlayable = true) {
  const safeItemJson = JSON.stringify({
    id: mediaItem.id,
    title: mediaItem.title || 'NetFlixxy Video',
    filePath: mediaItem.filePath,
    duration: mediaItem.duration || 0,
    isDirectPlayable: !!isDirectPlayable,
    initialProgress: initialProgress || 0
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#000000">
  <title>${mediaItem.title || 'Player'} • NetFlixxy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    }
    .player-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #000;
    }
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      transition: opacity 0.3s ease;
    }
    .back-btn {
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 20px;
    }
    .media-title {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    video {
      width: 100%;
      height: 100%;
      background: #000;
      object-fit: contain;
      outline: none;
    }
    .toast {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20,20,20,0.9);
      border: 1px solid rgba(229,9,20,0.5);
      color: #fff;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      z-index: 60;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    .toast.show {
      opacity: 1;
    }
  </style>
  <script src="/hls.min.js"></script>
</head>
<body>
  <div class="player-container">
    <div class="top-bar" id="topBar">
      <a href="/" class="back-btn">← Library</a>
      <div class="media-title">${mediaItem.title || 'NetFlixxy Player'}</div>
    </div>
    <video id="videoPlayer" controls playsinline autoplay></video>
    <div class="toast" id="toast"></div>
  </div>

  <script>
    const MEDIA_ITEM = ${safeItemJson};
    const video = document.getElementById('videoPlayer');
    const toast = document.getElementById('toast');
    let hasResumed = false;
    let hlsInstance = null;

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function formatTime(s) {
      if (!s || isNaN(s)) return '0:00';
      const sec = Math.floor(s);
      const m = Math.floor(sec / 60);
      return m + ':' + String(sec % 60).padStart(2, '0');
    }

    // Save progress to server
    function saveProgress(currentTime, duration, completed = false) {
      if (!currentTime || isNaN(currentTime) || currentTime < 0) return;
      const payload = {
        id: MEDIA_ITEM.id,
        filePath: MEDIA_ITEM.filePath,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration || MEDIA_ITEM.duration || 0),
        completed: !!completed
      };

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/progress', blob);
      } else {
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    }

    // Periodic progress save every 5 seconds
    setInterval(() => {
      if (!video.paused && video.currentTime > 0) {
        saveProgress(video.currentTime, video.duration);
      }
    }, 5000);

    video.addEventListener('pause', () => {
      saveProgress(video.currentTime, video.duration);
    });

    video.addEventListener('ended', () => {
      saveProgress(video.duration, video.duration, true);
    });

    window.addEventListener('beforeunload', () => {
      saveProgress(video.currentTime, video.duration);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveProgress(video.currentTime, video.duration);
      }
    });

    // Initialize media playback
    const resumeSec = MEDIA_ITEM.initialProgress || 0;

    if (MEDIA_ITEM.isDirectPlayable) {
      // Direct HTTP Range 206 stream for MP4/WebM
      const streamUrl = '/stream?file=' + encodeURIComponent(MEDIA_ITEM.filePath);
      video.src = streamUrl;

      video.addEventListener('loadedmetadata', () => {
        if (!hasResumed && resumeSec > 5) {
          hasResumed = true;
          video.currentTime = resumeSec;
          showToast('Resuming from ' + formatTime(resumeSec));
        }
        video.play().catch(() => {});
      }, { once: true });
    } else {
      // MKV, HEVC, AC3, DTS: Use HLS via hls.js
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          startPosition: resumeSec > 5 ? resumeSec : 0
        });
        hlsInstance = hls;

        const hlsUrl = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone';
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (resumeSec > 5) {
            showToast('Resuming from ' + formatTime(resumeSec));
          }
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn('[Phone HLS Error]', data);
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
        // Native HLS for Safari on iOS
        video.src = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone';
        if (resumeSec > 5) {
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = resumeSec;
            showToast('Resuming from ' + formatTime(resumeSec));
          }, { once: true });
        }
        video.play().catch(() => {});
      } else {
        // Fallback to direct stream
        video.src = '/stream?file=' + encodeURIComponent(MEDIA_ITEM.filePath);
        video.play().catch(() => {});
      }
    }
  </script>
</body>
</html>`;
}
