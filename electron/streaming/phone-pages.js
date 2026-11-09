/**
 * Plain HTML, CSS, and JavaScript templates for Phone Streaming Mode.
 * Completely offline, dark theme (#141414) with Netflix red accent (#e50914).
 * Zero external CDN dependencies.
 */

export function renderPinHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#141414">
  <title>Unlock NetFlixxy • Home Wi-Fi</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: #141414;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1c1c1c;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 28px 24px;
      width: 100%;
      max-width: 360px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
    }
    .logo {
      color: #e50914;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .subtitle {
      color: #888;
      font-size: 13px;
      margin-bottom: 22px;
    }
    .input-group {
      margin-bottom: 18px;
    }
    .pin-input {
      width: 100%;
      background: #282828;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 20px;
      color: #fff;
      text-align: center;
      letter-spacing: 4px;
      outline: none;
      transition: border-color 0.2s;
    }
    .pin-input:focus {
      border-color: #e50914;
    }
    .submit-btn {
      width: 100%;
      background: #e50914;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 13px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .submit-btn:active {
      transform: scale(0.98);
      background: #b80710;
    }
    .error-msg {
      color: #ff4d4d;
      font-size: 13px;
      margin-top: 12px;
      min-height: 18px;
    }
    .footer-note {
      color: #666;
      font-size: 11px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">NetFlixxy</div>
    <div class="subtitle">Enter PIN to access and manage library</div>
    <form id="pinForm" onsubmit="handlePinSubmit(event)">
      <div class="input-group">
        <input type="password" id="pinInput" class="pin-input" placeholder="••••" autofocus maxlength="20" inputmode="numeric" />
      </div>
      <button type="submit" class="submit-btn" id="submitBtn">Unlock</button>
      <div id="errorMsg" class="error-msg"></div>
    </form>
    <div class="footer-note">Default PIN is 1234. Change it in PC Settings.</div>
  </div>

  <script>
    async function handlePinSubmit(e) {
      e.preventDefault();
      const pin = document.getElementById('pinInput').value.trim();
      const errorDiv = document.getElementById('errorMsg');
      const submitBtn = document.getElementById('submitBtn');
      if (!pin) {
        errorDiv.textContent = 'Please enter your PIN';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';
      errorDiv.textContent = '';
      try {
        const res = await fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          window.location.href = '/';
        } else {
          errorDiv.textContent = data.error || 'Incorrect PIN';
        }
      } catch (err) {
        errorDiv.textContent = 'Connection error: ' + err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock';
      }
    }
  </script>
</body>
</html>`;
}

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
      background: rgba(20, 20, 20, 0.96);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 12px 16px;
      border-bottom: 1px solid #282828;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
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
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rescan-btn {
      background: #262626;
      border: 1px solid #444;
      color: #eee;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .rescan-btn:active {
      background: #333;
      transform: scale(0.97);
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

    /* Notification & Scanning Banners */
    .banner {
      background: #1f1f1f;
      border-bottom: 1px solid #333;
      padding: 10px 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #ddd;
    }
    .banner.active {
      background: rgba(229, 9, 20, 0.15);
      border-color: rgba(229, 9, 20, 0.4);
      color: #fff;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #e50914;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Rows and Sideways Scrolling */
    .content-area {
      padding: 16px 0;
    }
    .category-row {
      margin-bottom: 26px;
    }
    .row-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 16px 8px 16px;
    }
    .row-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.2px;
    }
    .row-count {
      font-size: 12px;
      color: #888;
    }
    .row-scroll {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 4px 16px 12px 16px;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .row-scroll::-webkit-scrollbar {
      display: none;
    }

    /* Cards */
    .card {
      flex: 0 0 130px;
      scroll-snap-align: start;
      background: #1c1c1c;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      position: relative;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      transition: transform 0.15s ease;
    }
    @media (min-width: 600px) {
      .card {
        flex: 0 0 160px;
      }
    }
    .card:active {
      transform: scale(0.96);
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
      background: #242424;
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
    .badge.continue { border-left: 2px solid #46d369; }

    /* Saved Progress Bar */
    .progress-bar-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.25);
    }
    .progress-bar-fill {
      height: 100%;
      background: #e50914;
    }

    .card-info {
      padding: 8px 10px;
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

    /* Search Results Grid */
    .search-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 14px 10px;
      padding: 0 16px;
    }
    @media (min-width: 600px) {
      .search-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 18px 14px;
      }
    }
    .search-grid .card {
      flex: none;
    }

    /* Modal / Drawer */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #282828;
    }
    .drawer-title-wrap {
      flex: 1;
      overflow: hidden;
      margin-right: 12px;
    }
    .drawer-title {
      font-size: 17px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
      font-size: 18px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
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
      border-bottom: 1px solid #282828;
      scrollbar-width: none;
    }
    .season-selector::-webkit-scrollbar { display: none; }
    .season-btn {
      background: #252525;
      border: 1px solid #383838;
      color: #aaa;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
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
      align-items: center;
      gap: 12px;
      background: #202020;
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .episode-card:active {
      background: #282828;
    }
    .ep-thumb-wrap {
      width: 80px;
      aspect-ratio: 16 / 9;
      background: #2c2c2c;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      flex-shrink: 0;
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
      background: rgba(255,255,255,0.25);
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
      font-weight: 700;
      color: #00a8e8;
      text-transform: uppercase;
    }
    .ep-title {
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .ep-meta {
      font-size: 11px;
      color: #888;
      margin-top: 3px;
    }

    /* Modal for PIN */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 300;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(5px);
    }
    .modal-card {
      background: #1c1c1c;
      border: 1px solid #383838;
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 340px;
      text-align: center;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .modal-subtitle {
      font-size: 12px;
      color: #888;
      margin-bottom: 18px;
    }
    .modal-input {
      width: 100%;
      background: #282828;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 10px;
      font-size: 18px;
      color: #fff;
      text-align: center;
      letter-spacing: 3px;
      outline: none;
      margin-bottom: 14px;
    }
    .modal-input:focus {
      border-color: #e50914;
    }
    .modal-actions {
      display: flex;
      gap: 10px;
    }
    .modal-btn {
      flex: 1;
      padding: 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .modal-btn.cancel {
      background: #333;
      color: #ccc;
    }
    .modal-btn.submit {
      background: #e50914;
      color: #fff;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20,20,20,0.92);
      border: 1px solid rgba(229,9,20,0.6);
      color: #fff;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      z-index: 400;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <div class="brand">
        <span class="logo">NetFlixxy</span>
        <span class="wifi-badge">Wi-Fi</span>
      </div>
      <div class="header-actions">
        <button id="rescanBtn" class="rescan-btn" onclick="handleRescanClick()">
          <span>🔄</span>
          <span>Rescan</span>
        </button>
      </div>
    </div>
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="searchInput" class="search-input" placeholder="Search movies, series, anime..." />
    </div>
  </header>

  <div id="rescanBanner" class="banner" style="display:none;">
    <div class="spinner"></div>
    <span id="rescanMsg">Scanning library on PC... please wait</span>
  </div>

  <main class="content-area" id="mainContent">
    <!-- Category Rows (Populated by JS) -->
    <div id="rowsContainer"></div>

    <!-- Search Results View (Hidden by default) -->
    <div id="searchResultsSection" style="display:none;">
      <div class="row-header">
        <div class="row-title" id="searchHeaderTitle">Search Results</div>
        <div class="row-count" id="searchHeaderCount"></div>
      </div>
      <div class="search-grid" id="searchGrid"></div>
    </div>
  </main>

  <!-- Episode Drawer -->
  <div class="drawer-overlay" id="drawerOverlay">
    <div class="drawer-panel">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <div class="drawer-title" id="drawerTitle">Series Title</div>
          <div class="drawer-subtitle" id="drawerSubtitle"></div>
        </div>
        <button class="drawer-close" id="drawerClose">&times;</button>
      </div>
      <div class="season-selector" id="seasonSelector"></div>
      <div class="episodes-list" id="episodesList"></div>
    </div>
  </div>

  <!-- PIN Modal for Rescan -->
  <div class="modal-overlay" id="pinModal">
    <div class="modal-card">
      <div class="modal-title">PIN Required</div>
      <div class="modal-subtitle">Enter your NetFlixxy PIN to rescan the library from phone</div>
      <input type="password" id="modalPinInput" class="modal-input" placeholder="••••" maxlength="20" inputmode="numeric" />
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closePinModal()">Cancel</button>
        <button class="modal-btn submit" id="modalSubmitBtn" onclick="submitPinForRescan()">Verify & Rescan</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let libraryData = { movies: [], series: [], anime: [] };
    let searchQuery = '';
    let selectedSeries = null;
    let selectedSeason = null;

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function formatTime(s) {
      if (!s || isNaN(s)) return '0:00';
      const sec = Math.floor(s);
      const m = Math.floor(sec / 60);
      return m + ':' + String(sec % 60).padStart(2, '0');
    }

    async function loadLibrary() {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        libraryData = await res.json();
        render();
      } catch (e) {
        showToast('Error loading library: ' + e.message);
      }
    }

    // Build Continue Watching list from all media types
    function getContinueWatchingList() {
      const list = [];
      const checkItem = (item, type, seriesTitle = '') => {
        if (item.progress && item.progress.currentTime > 5 && !item.progress.completed) {
          const duration = item.progress.duration || item.duration || 1;
          const pct = Math.round((item.progress.currentTime / duration) * 100);
          if (pct < 95) {
            list.push({
              ...item,
              itemType: type,
              seriesTitle,
              pct,
              updatedAt: item.progress.updatedAt || 0
            });
          }
        }
      };

      for (const m of (libraryData.movies || [])) {
        checkItem(m, 'movie');
      }

      const allSeries = [...(libraryData.series || []), ...(libraryData.anime || [])];
      for (const s of allSeries) {
        for (const [sNum, eps] of Object.entries(s.seasons || {})) {
          if (Array.isArray(eps)) {
            for (const ep of eps) {
              checkItem(ep, 'series', s.title);
            }
          }
        }
      }

      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return list;
    }

    function renderCard(item, badgeType, badgeLabel, onClickHandler) {
      let thumbSrc = '';
      if (item.poster) {
        thumbSrc = '/thumb?file=' + encodeURIComponent(item.poster);
      } else if (item.filePath) {
        thumbSrc = '/thumb?file=' + encodeURIComponent(item.filePath);
      }

      let progressHtml = '';
      if (item.progress && item.progress.duration > 0 && item.progress.currentTime > 0) {
        const pct = Math.min(100, Math.max(1, Math.round((item.progress.currentTime / item.progress.duration) * 100)));
        progressHtml = '<div class="progress-bar-container"><div class="progress-bar-fill" style="width: ' + pct + '%;"></div></div>';
      }

      const title = item.seriesTitle
        ? item.seriesTitle + ' • S' + (item.season || 1) + ':E' + (item.episode || 1)
        : (item.title || 'Untitled');

      const meta = item.progress && item.progress.currentTime > 0
        ? formatTime(item.progress.currentTime) + ' / ' + formatTime(item.progress.duration)
        : (item.year || (item.seasons ? Object.keys(item.seasons).length + ' S' : ''));

      return '<div class="card" onclick="' + onClickHandler + '">' +
        '<div class="card-thumb-wrap">' +
          (thumbSrc ? '<img class="card-thumb" src="' + thumbSrc + '" loading="lazy" onerror="this.style.display=\\'none\\';this.nextElementSibling.style.display=\\'flex\\';">' : '') +
          '<div class="card-thumb-placeholder" style="' + (thumbSrc ? 'display:none;' : '') + '">🎬</div>' +
          '<span class="badge ' + badgeType + '">' + badgeLabel + '</span>' +
          progressHtml +
        '</div>' +
        '<div class="card-info">' +
          '<div class="card-title">' + title + '</div>' +
          '<div class="card-meta"><span>' + meta + '</span></div>' +
        '</div>' +
      '</div>';
    }

    function render() {
      const rowsContainer = document.getElementById('rowsContainer');
      const searchSection = document.getElementById('searchResultsSection');
      const searchGrid = document.getElementById('searchGrid');

      if (searchQuery.trim()) {
        rowsContainer.style.display = 'none';
        searchSection.style.display = 'block';

        const q = searchQuery.toLowerCase().trim();
        const matches = [];

        for (const m of (libraryData.movies || [])) {
          if (m.title && m.title.toLowerCase().includes(q)) matches.push({ item: m, type: 'movie', label: 'Movie' });
        }
        for (const s of (libraryData.series || [])) {
          if (s.title && s.title.toLowerCase().includes(q)) matches.push({ item: s, type: 'series', label: 'Series' });
        }
        for (const a of (libraryData.anime || [])) {
          if (a.title && a.title.toLowerCase().includes(q)) matches.push({ item: a, type: 'anime', label: 'Anime' });
        }

        document.getElementById('searchHeaderTitle').textContent = 'Search Results for "' + searchQuery + '"';
        document.getElementById('searchHeaderCount').textContent = matches.length + ' found';

        if (matches.length === 0) {
          searchGrid.innerHTML = '<div style="color:#777;grid-column:1/-1;padding:40px 0;text-align:center;">No titles matched your search</div>';
        } else {
          searchGrid.innerHTML = matches.map(m =>
            renderCard(m.item, m.type, m.label, 'handleItemClick(\\'' + m.item.id + '\\')')
          ).join('');
        }
        return;
      }

      rowsContainer.style.display = 'block';
      searchSection.style.display = 'none';

      let html = '';

      // 1. Continue Watching Row
      const continueWatching = getContinueWatchingList();
      if (continueWatching.length > 0) {
        html += '<div class="category-row">' +
          '<div class="row-header">' +
            '<div class="row-title">Continue Watching</div>' +
            '<div class="row-count">' + continueWatching.length + ' titles</div>' +
          '</div>' +
          '<div class="row-scroll">' +
            continueWatching.map(item =>
              renderCard(item, 'continue', 'Resume', 'window.location.href=\\'/watch/' + encodeURIComponent(item.id) + '\\'')
            ).join('') +
          '</div>' +
        '</div>';
      }

      // 2. Movies Row
      const movies = libraryData.movies || [];
      html += '<div class="category-row">' +
        '<div class="row-header">' +
          '<div class="row-title">Movies</div>' +
          '<div class="row-count">' + movies.length + ' titles</div>' +
        '</div>' +
        '<div class="row-scroll">' +
          (movies.length > 0
            ? movies.map(m => renderCard(m, 'movie', 'Movie', 'handleItemClick(\\'' + m.id + '\\')')).join('')
            : '<div style="color:#666;padding:10px 16px;">No movies found</div>') +
        '</div>' +
      '</div>';

      // 3. Series Row
      const series = libraryData.series || [];
      html += '<div class="category-row">' +
        '<div class="row-header">' +
          '<div class="row-title">Series</div>' +
          '<div class="row-count">' + series.length + ' titles</div>' +
        '</div>' +
        '<div class="row-scroll">' +
          (series.length > 0
            ? series.map(s => renderCard(s, 'series', 'Series', 'handleItemClick(\\'' + s.id + '\\')')).join('')
            : '<div style="color:#666;padding:10px 16px;">No series found</div>') +
        '</div>' +
      '</div>';

      // 4. Anime Row
      const anime = libraryData.anime || [];
      html += '<div class="category-row">' +
        '<div class="row-header">' +
          '<div class="row-title">Anime</div>' +
          '<div class="row-count">' + anime.length + ' titles</div>' +
        '</div>' +
        '<div class="row-scroll">' +
          (anime.length > 0
            ? anime.map(a => renderCard(a, 'anime', 'Anime', 'handleItemClick(\\'' + a.id + '\\')')).join('')
            : '<div style="color:#666;padding:10px 16px;">No anime found</div>') +
        '</div>' +
      '</div>';

      rowsContainer.innerHTML = html;
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

      if (item.type === 'series' || item.seasons) {
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

    // Rescan Handlers
    window.handleRescanClick = function() {
      triggerRescan();
    };

    async function triggerRescan() {
      const banner = document.getElementById('rescanBanner');
      const rescanBtn = document.getElementById('rescanBtn');
      rescanBtn.disabled = true;
      banner.style.display = 'flex';
      banner.classList.add('active');
      document.getElementById('rescanMsg').textContent = 'Scanning library on PC... please wait';

      try {
        const res = await fetch('/api/rescan', { method: 'POST' });
        if (res.status === 401) {
          banner.style.display = 'none';
          rescanBtn.disabled = false;
          showPinModal();
          return;
        }
        if (res.status === 409) {
          banner.style.display = 'none';
          rescanBtn.disabled = false;
          showToast('A scan is already in progress');
          return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        showToast('Rescan completed! ' + (data.totalVideos || '') + ' videos found');
        await loadLibrary();
      } catch (e) {
        showToast('Rescan error: ' + e.message);
      } finally {
        banner.style.display = 'none';
        banner.classList.remove('active');
        rescanBtn.disabled = false;
      }
    }

    function showPinModal() {
      document.getElementById('pinModal').style.display = 'flex';
      document.getElementById('modalPinInput').value = '';
      document.getElementById('modalPinInput').focus();
    }

    window.closePinModal = function() {
      document.getElementById('pinModal').style.display = 'none';
    };

    window.submitPinForRescan = async function() {
      const pin = document.getElementById('modalPinInput').value.trim();
      if (!pin) {
        showToast('Please enter PIN');
        return;
      }
      const submitBtn = document.getElementById('modalSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const vRes = await fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const vData = await vRes.json();
        if (vRes.ok && vData.success) {
          closePinModal();
          triggerRescan();
        } else {
          showToast(vData.error || 'Invalid PIN');
        }
      } catch (err) {
        showToast('Connection error: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify & Rescan';
      }
    };

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

export function renderPlayerHtml(mediaItem, initialProgress = 0, details = {}) {
  const isDirectPlayable = details.isDirectPlayable ?? true;
  const audioTracks = details.audioTracks || [];
  const subtitleTracks = details.subtitleTracks || [];

  const safeItemJson = JSON.stringify({
    id: mediaItem.id,
    title: mediaItem.title || 'NetFlixxy Video',
    filePath: mediaItem.filePath,
    duration: mediaItem.duration || details.duration || 0,
    isDirectPlayable: !!isDirectPlayable,
    initialProgress: initialProgress || 0,
    audioTracks,
    subtitleTracks
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#000000">
  <title>${mediaItem.title || 'Player'} • NetFlixxy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    .player-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #000;
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      background: #000;
      object-fit: contain;
      outline: none;
    }

    /* Double-tap hit zones (Left & Right halves) */
    .tap-zone {
      position: absolute;
      top: 60px;
      bottom: 70px;
      width: 50%;
      z-index: 20;
    }
    .tap-zone.left { left: 0; }
    .tap-zone.right { right: 0; }

    /* Skip Indicator Animation */
    .skip-indicator {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(229, 9, 20, 0.6);
      color: #fff;
      padding: 14px 22px;
      border-radius: 30px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      z-index: 35;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
    }
    .skip-indicator.left { left: 15%; }
    .skip-indicator.right { right: 15%; }
    .skip-indicator.show {
      opacity: 1;
      transform: translateY(-50%) scale(1.08);
    }

    /* Top Title Bar */
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .top-bar.hidden {
      opacity: 0;
      transform: translateY(-10px);
      pointer-events: none;
    }
    .back-btn {
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.18);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 16px;
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
    .control-btn {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.25);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      backdrop-filter: blur(8px);
    }
    .control-btn.active {
      background: #e50914;
      border-color: #e50914;
    }

    /* Bottom Controls */
    .bottom-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      z-index: 40;
      padding: 12px 16px 20px 16px;
      background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .bottom-controls.hidden {
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
    }
    .timeline-container {
      width: 100%;
      display: flex;
      align-items: center;
    }
    .timeline {
      width: 100%;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255,255,255,0.25);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .timeline::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #e50914;
      cursor: pointer;
    }
    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .controls-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .play-pause-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }
    .time-display {
      font-size: 12px;
      font-weight: 500;
      color: #ccc;
      font-variant-numeric: tabular-nums;
    }
    .fullscreen-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
    }

    /* Audio / Subtitle Modals */
    .menu-modal {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: #181818;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      z-index: 100;
      display: none;
      flex-direction: column;
      max-height: 60vh;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.8);
      animation: menuUp 0.2s ease-out;
    }
    .menu-modal.active {
      display: flex;
    }
    @keyframes menuUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .menu-header {
      padding: 14px 16px;
      border-bottom: 1px solid #282828;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .menu-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .menu-close {
      background: none;
      border: none;
      color: #aaa;
      font-size: 20px;
      cursor: pointer;
    }
    .menu-list {
      overflow-y: auto;
      padding: 8px 0 20px 0;
    }
    .menu-item {
      padding: 12px 16px;
      font-size: 14px;
      color: #ddd;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      border-bottom: 1px solid #222;
    }
    .menu-item:active {
      background: #252525;
    }
    .menu-item.selected {
      color: #e50914;
      font-weight: 700;
    }

    .toast {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20,20,20,0.92);
      border: 1px solid rgba(229,9,20,0.6);
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
  <div class="player-container" id="playerContainer">
    <!-- Top Bar -->
    <div class="top-bar" id="topBar">
      <a href="/" class="back-btn">←</a>
      <div class="media-title">${mediaItem.title || 'NetFlixxy Player'}</div>
      <button class="control-btn" id="audioBtn" onclick="toggleAudioMenu()">🔊 Audio</button>
      <button class="control-btn" id="subBtn" onclick="toggleSubMenu()">💬 Subtitles</button>
    </div>

    <!-- Video Element -->
    <video id="videoPlayer" playsinline></video>

    <!-- Tap Detection Zones -->
    <div class="tap-zone left" id="tapLeft" onclick="handleTapLeft()"></div>
    <div class="tap-zone right" id="tapRight" onclick="handleTapRight()"></div>

    <!-- Skip Amount Overlays -->
    <div class="skip-indicator left" id="skipIndicatorLeft">◀◀ 10s</div>
    <div class="skip-indicator right" id="skipIndicatorRight">10s ▶▶</div>

    <!-- Bottom Controls -->
    <div class="bottom-controls" id="bottomControls">
      <div class="timeline-container">
        <input type="range" class="timeline" id="timeline" min="0" max="100" value="0" step="0.1" />
      </div>
      <div class="controls-row">
        <div class="controls-left">
          <button class="play-pause-btn" id="playPauseBtn" onclick="togglePlayPause()">▶</button>
          <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
        </div>
        <button class="fullscreen-btn" id="fullscreenBtn" onclick="toggleFullscreen()">⛶</button>
      </div>
    </div>

    <!-- Audio Selection Menu -->
    <div class="menu-modal" id="audioModal">
      <div class="menu-header">
        <div class="menu-title">Audio Tracks</div>
        <button class="menu-close" onclick="closeAudioMenu()">&times;</button>
      </div>
      <div class="menu-list" id="audioList"></div>
    </div>

    <!-- Subtitle Selection Menu -->
    <div class="menu-modal" id="subModal">
      <div class="menu-header">
        <div class="menu-title">Subtitles</div>
        <button class="menu-close" onclick="closeSubMenu()">&times;</button>
      </div>
      <div class="menu-list" id="subList"></div>
    </div>

    <div class="toast" id="toast"></div>
  </div>

  <script>
    const MEDIA_ITEM = ${safeItemJson};
    const video = document.getElementById('videoPlayer');
    const toast = document.getElementById('toast');
    const topBar = document.getElementById('topBar');
    const bottomControls = document.getElementById('bottomControls');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const timeline = document.getElementById('timeline');
    const audioBtn = document.getElementById('audioBtn');
    const subBtn = document.getElementById('subBtn');

    let hlsInstance = null;
    let currentAudioIndex = 0;
    // CRITICAL: Subtitles start OFF on every video
    let currentSubtitleIndex = -1; // -1 represents "Off"
    let controlsTimer = null;
    let controlsVisible = true;
    let isSeeking = false;
    let leftTapTimer = null;
    let rightTapTimer = null;
    let skipLeftHideTimer = null;
    let skipRightHideTimer = null;

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function formatTime(s) {
      if (!s || isNaN(s)) return '0:00';
      const sec = Math.floor(s);
      const m = Math.floor(sec / 60);
      return m + ':' + String(sec % 60).padStart(2, '0');
    }

    // Auto-hide Controls after 3 seconds
    function resetControlsTimer() {
      clearTimeout(controlsTimer);
      if (!video.paused) {
        controlsTimer = setTimeout(hideControls, 3000);
      }
    }

    function showControls() {
      controlsVisible = true;
      topBar.classList.remove('hidden');
      bottomControls.classList.remove('hidden');
      resetControlsTimer();
    }

    function hideControls() {
      // Don't hide if audio or subtitle menu is currently open
      if (document.getElementById('audioModal').classList.contains('active') ||
          document.getElementById('subModal').classList.contains('active')) {
        return;
      }
      controlsVisible = false;
      topBar.classList.add('hidden');
      bottomControls.classList.add('hidden');
    }

    function toggleControls() {
      if (controlsVisible) {
        hideControls();
      } else {
        showControls();
      }
    }

    // Double-tap vs Single-tap detection
    window.handleTapLeft = function() {
      if (leftTapTimer) {
        clearTimeout(leftTapTimer);
        leftTapTimer = null;
        skipTime(-10);
        showSkipIndicator('left');
      } else {
        leftTapTimer = setTimeout(() => {
          leftTapTimer = null;
          toggleControls();
        }, 260);
      }
    };

    window.handleTapRight = function() {
      if (rightTapTimer) {
        clearTimeout(rightTapTimer);
        rightTapTimer = null;
        skipTime(10);
        showSkipIndicator('right');
      } else {
        rightTapTimer = setTimeout(() => {
          rightTapTimer = null;
          toggleControls();
        }, 260);
      }
    };

    function skipTime(delta) {
      const target = Math.max(0, Math.min(video.duration || 1e6, video.currentTime + delta));
      video.currentTime = target;
      updateTimeline();
      resetControlsTimer();
    }

    function showSkipIndicator(side) {
      if (side === 'left') {
        const el = document.getElementById('skipIndicatorLeft');
        el.classList.add('show');
        clearTimeout(skipLeftHideTimer);
        skipLeftHideTimer = setTimeout(() => el.classList.remove('show'), 700);
      } else {
        const el = document.getElementById('skipIndicatorRight');
        el.classList.add('show');
        clearTimeout(skipRightHideTimer);
        skipRightHideTimer = setTimeout(() => el.classList.remove('show'), 700);
      }
    }

    window.togglePlayPause = function() {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    video.addEventListener('play', () => {
      playPauseBtn.textContent = '❚❚';
      resetControlsTimer();
    });

    video.addEventListener('pause', () => {
      playPauseBtn.textContent = '▶';
      showControls();
      saveProgress(video.currentTime, video.duration);
    });

    video.addEventListener('timeupdate', () => {
      if (!isSeeking) {
        updateTimeline();
      }
    });

    function updateTimeline() {
      const cur = video.currentTime || 0;
      const dur = video.duration || MEDIA_ITEM.duration || 0;
      timeDisplay.textContent = formatTime(cur) + ' / ' + formatTime(dur);
      if (dur > 0) {
        timeline.value = (cur / dur) * 100;
      }
    }

    timeline.addEventListener('input', () => {
      isSeeking = true;
      const dur = video.duration || MEDIA_ITEM.duration || 0;
      if (dur > 0) {
        const cur = (timeline.value / 100) * dur;
        timeDisplay.textContent = formatTime(cur) + ' / ' + formatTime(dur);
      }
    });

    timeline.addEventListener('change', () => {
      isSeeking = false;
      const dur = video.duration || MEDIA_ITEM.duration || 0;
      if (dur > 0) {
        video.currentTime = (timeline.value / 100) * dur;
      }
      resetControlsTimer();
    });

    window.toggleFullscreen = function() {
      if (!document.fullscreenElement) {
        document.getElementById('playerContainer').requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    // Save Progress every 5 seconds and on leave
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

    setInterval(() => {
      if (!video.paused && video.currentTime > 0) {
        saveProgress(video.currentTime, video.duration);
      }
    }, 5000);

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

    // Audio Selection
    window.toggleAudioMenu = function() {
      const modal = document.getElementById('audioModal');
      if (modal.classList.contains('active')) {
        closeAudioMenu();
      } else {
        closeSubMenu();
        renderAudioList();
        modal.classList.add('active');
        showControls();
      }
    };

    window.closeAudioMenu = function() {
      document.getElementById('audioModal').classList.remove('active');
      resetControlsTimer();
    };

    function renderAudioList() {
      const list = document.getElementById('audioList');
      const tracks = MEDIA_ITEM.audioTracks || [];
      if (tracks.length === 0) {
        list.innerHTML = '<div style="padding:16px;color:#888;text-align:center;">Default Audio</div>';
        return;
      }
      list.innerHTML = tracks.map((t, idx) => {
        const isSel = idx === currentAudioIndex;
        return '<div class="menu-item ' + (isSel ? 'selected' : '') + '" onclick="selectAudioTrack(' + idx + ')">' +
          '<span>' + (t.label || ('Track ' + (idx + 1))) + '</span>' +
          (isSel ? '<span>✓</span>' : '') +
        '</div>';
      }).join('');
    }

    window.selectAudioTrack = function(index) {
      if (index === currentAudioIndex) {
        closeAudioMenu();
        return;
      }
      currentAudioIndex = index;
      closeAudioMenu();
      showToast('Switched audio: ' + (MEDIA_ITEM.audioTracks[index]?.label || ('Track ' + (index + 1))));

      // For MKV on HLS, reload HLS source specifying chosen audio track
      if (hlsInstance) {
        const savedTime = video.currentTime;
        const hlsUrl = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone&audio=' + currentAudioIndex;
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.once(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = savedTime;
          video.play().catch(() => {});
        });
      } else if (!MEDIA_ITEM.isDirectPlayable) {
        // Direct iOS Safari native HLS reload
        const savedTime = video.currentTime;
        video.src = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone&audio=' + currentAudioIndex;
        video.currentTime = savedTime;
        video.play().catch(() => {});
      }
    };

    // Subtitle Selection (Starts OFF by default)
    window.toggleSubMenu = function() {
      const modal = document.getElementById('subModal');
      if (modal.classList.contains('active')) {
        closeSubMenu();
      } else {
        closeAudioMenu();
        renderSubList();
        modal.classList.add('active');
        showControls();
      }
    };

    window.closeSubMenu = function() {
      document.getElementById('subModal').classList.remove('active');
      resetControlsTimer();
    };

    function renderSubList() {
      const list = document.getElementById('subList');
      const tracks = MEDIA_ITEM.subtitleTracks || [];
      let html = '<div class="menu-item ' + (currentSubtitleIndex === -1 ? 'selected' : '') + '" onclick="selectSubTrack(-1)">' +
        '<span>Off</span>' +
        (currentSubtitleIndex === -1 ? '<span>✓</span>' : '') +
      '</div>';

      html += tracks.map((t, idx) => {
        const isSel = idx === currentSubtitleIndex;
        return '<div class="menu-item ' + (isSel ? 'selected' : '') + '" onclick="selectSubTrack(' + idx + ')">' +
          '<span>' + (t.label || ('Subtitle ' + (idx + 1))) + '</span>' +
          (isSel ? '<span>✓</span>' : '') +
        '</div>';
      }).join('');

      list.innerHTML = html;
    }

    window.selectSubTrack = function(index) {
      currentSubtitleIndex = index;
      closeSubMenu();

      // Disable any existing text tracks
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }

      // Remove existing <track> elements
      const existingTracks = video.querySelectorAll('track');
      existingTracks.forEach(t => t.remove());

      if (index === -1) {
        subBtn.classList.remove('active');
        showToast('Subtitles Off');
        return;
      }

      const chosen = MEDIA_ITEM.subtitleTracks[index];
      if (!chosen) return;

      subBtn.classList.add('active');
      showToast('Subtitles: ' + chosen.label);

      // Add track element pointing to server converted VTT
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = chosen.label;
      track.srclang = chosen.language || 'en';
      track.src = chosen.url;
      track.default = true;
      video.appendChild(track);

      track.addEventListener('load', () => {
        track.track.mode = 'showing';
      });
    };

    // Initialize Playback
    const resumeSec = MEDIA_ITEM.initialProgress || 0;

    if (MEDIA_ITEM.isDirectPlayable) {
      const streamUrl = '/stream?file=' + encodeURIComponent(MEDIA_ITEM.filePath);
      video.src = streamUrl;

      video.addEventListener('loadedmetadata', () => {
        if (resumeSec > 5) {
          video.currentTime = resumeSec;
          showToast('Resuming from ' + formatTime(resumeSec));
        }
        video.play().catch(() => {});
      }, { once: true });
    } else {
      // MKV, AC3, DTS, HEVC: HLS streaming
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          startPosition: resumeSec > 5 ? resumeSec : 0
        });
        hlsInstance = hls;

        const hlsUrl = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone&audio=' + currentAudioIndex;
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
        // iOS Safari native HLS
        video.src = '/hls/playlist.m3u8?file=' + encodeURIComponent(MEDIA_ITEM.filePath) + '&player=phone&audio=' + currentAudioIndex;
        if (resumeSec > 5) {
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = resumeSec;
            showToast('Resuming from ' + formatTime(resumeSec));
          }, { once: true });
        }
        video.play().catch(() => {});
      } else {
        video.src = '/stream?file=' + encodeURIComponent(MEDIA_ITEM.filePath);
        video.play().catch(() => {});
      }
    }

    // Controls start visible then auto-hide after 3 seconds
    showControls();
  </script>
</body>
</html>`;
}
