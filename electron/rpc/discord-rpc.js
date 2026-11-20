import net from 'net';
import crypto from 'crypto';

const DEFAULT_CLIENT_ID = '868487355114323968'; // Netflix application ID on Discord
const APP_ICON_URL = 'https://raw.githubusercontent.com/not-amey/NetFlixxy/main/assets/icon.png';

class DiscordRPC {
  constructor() {
    this.clientId = DEFAULT_CLIENT_ID;
    this.socket = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.lastActivity = null;
    this.lastActivityTime = 0;
    this.queuedActivity = null;
    this.throttleTimer = null;
    this.posterCache = new Map();
    this.appStartTime = Math.floor(Date.now() / 1000);
    this.enabled = true;
  }

  setClientId(clientId) {
    const id = clientId && String(clientId).trim() ? String(clientId).trim() : DEFAULT_CLIENT_ID;
    if (id !== this.clientId) {
      this.clientId = id;
      if (this.connected) {
        this.disconnect();
        this.connect();
      }
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clearActivity();
    } else if (this.lastActivity) {
      this.setActivity(this.lastActivity);
    }
  }

  connect() {
    if (!this.enabled) return;
    if (this.socket || this.connected) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Try Windows named pipes 0 through 9
    const tryConnectPipe = (pipeIndex) => {
      if (pipeIndex > 9 || !this.enabled) {
        // Schedule next reconnection attempt in 15 seconds
        this.reconnectTimer = setTimeout(() => this.connect(), 15000);
        return;
      }

      const pipePath = process.platform === 'win32'
        ? `\\\\.\\pipe\\discord-ipc-${pipeIndex}`
        : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'}/discord-ipc-${pipeIndex}`;

      const sock = net.createConnection(pipePath, () => {
        this.socket = sock;
        this.sendHandshake();
      });

      sock.on('data', (data) => {
        this.handleData(data);
      });

      sock.on('error', () => {
        sock.destroy();
        if (this.socket === sock) this.socket = null;
        tryConnectPipe(pipeIndex + 1);
      });

      sock.on('close', () => {
        if (this.socket === sock) {
          this.socket = null;
          this.connected = false;
          if (this.enabled && !this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => this.connect(), 15000);
          }
        }
      });
    };

    tryConnectPipe(0);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
  }

  sendHandshake() {
    if (!this.socket) return;
    try {
      const payload = JSON.stringify({ v: 1, client_id: this.clientId });
      const buf = Buffer.alloc(8 + Buffer.byteLength(payload));
      buf.writeInt32LE(0, 0); // Opcode 0 = HANDSHAKE
      buf.writeInt32LE(Buffer.byteLength(payload), 4);
      buf.write(payload, 8, 'utf-8');
      this.socket.write(buf);
    } catch (e) {
      console.warn('[DiscordRPC] Handshake error:', e.message);
    }
  }

  handleData(data) {
    try {
      if (data.length < 8) return;
      const opcode = data.readInt32LE(0);
      const length = data.readInt32LE(4);
      if (data.length < 8 + length) return;

      const rawJson = data.slice(8, 8 + length).toString('utf-8');
      const json = JSON.parse(rawJson);

      if (json.evt === 'READY') {
        this.connected = true;
        console.log('[DiscordRPC] Connected to Discord as', json.data?.user?.username);
        if (this.queuedActivity) {
          const act = this.queuedActivity;
          this.queuedActivity = null;
          this.sendActivity(act);
        }
      } else if (json.cmd === 'SET_ACTIVITY') {
        // Activity acknowledged by Discord
      }
    } catch (e) {
      console.warn('[DiscordRPC] Error parsing packet:', e.message);
    }
  }

  async fetchOnlinePoster(title, type = 'movie') {
    if (!title) return APP_ICON_URL;
    const cacheKey = `${title}_${type}`.toLowerCase();
    if (this.posterCache.has(cacheKey)) {
      return this.posterCache.get(cacheKey);
    }

    const cleanTitle = (title || '')
      .replace(/\b(2160p|4k|1080p|720p|480p|360p|bluray|bd|web-?dl|webrip|web|hdtv|hdrip|hevc|x265|x264|h264|h265|10bit|8bit|remux)\b/gi, ' ')
      .replace(/\[.*?\]|\(.*?\)/g, ' ')
      .replace(/[-–—_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const isSeries = (type === 'series' || type === 'anime');
    const targetLower = (cleanTitle || title).toLowerCase();

    // 1. Try Cinemeta first (has standard IMDb titles & IDs, accurately distinguishing original from spin-offs like Korea)
    try {
      const cinemetaType = isSeries ? 'series' : 'movie';
      const cinemetaUrl = `https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(cleanTitle || title)}.json`;
      const res = await fetch(cinemetaUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        const metas = data.metas || [];
        const exact = metas.find(m => m.name && m.name.toLowerCase() === targetLower);
        const poster = (exact && exact.poster) || (metas[0] && metas[0].poster);
        if (poster && poster.startsWith('http')) {
          this.posterCache.set(cacheKey, poster);
          return poster;
        }
      }
    } catch {}

    // 2. Try Cinemeta opposite category
    try {
      const cinemetaType = isSeries ? 'movie' : 'series';
      const cinemetaUrl = `https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(cleanTitle || title)}.json`;
      const res = await fetch(cinemetaUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        const metas = data.metas || [];
        const exact = metas.find(m => m.name && m.name.toLowerCase() === targetLower);
        const poster = (exact && exact.poster) || (metas[0] && metas[0].poster);
        if (poster && poster.startsWith('http')) {
          this.posterCache.set(cacheKey, poster);
          return poster;
        }
      }
    } catch {}

    // 3. Fallback to TVMaze for series (strictly excluding spin-offs unless asked)
    if (isSeries) {
      try {
        const tvUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle || title)}`;
        const res = await fetch(tvUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          const showName = (data.name || '').toLowerCase();
          if (showName === targetLower || (showName.includes(targetLower) && !showName.includes('korea') && !showName.includes('spin-off'))) {
            const poster = data.image?.original || data.image?.medium;
            if (poster && poster.startsWith('http')) {
              this.posterCache.set(cacheKey, poster);
              return poster;
            }
          }
        }
      } catch {}
    }

    return APP_ICON_URL;
  }

  setActivity(activity) {
    if (!this.enabled) return;
    this.lastActivity = activity;

    if (!this.connected) {
      this.queuedActivity = activity;
      this.connect();
      return;
    }

    const now = Date.now();
    // Discord allows max 1 SET_ACTIVITY per second; throttle to 1.5s
    if (now - this.lastActivityTime < 1500) {
      if (this.throttleTimer) clearTimeout(this.throttleTimer);
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.sendActivity(this.lastActivity);
      }, 1500 - (now - this.lastActivityTime));
      return;
    }

    this.sendActivity(activity);
  }

  sendActivity(activity) {
    if (!this.socket || !this.connected) return;
    this.lastActivityTime = Date.now();

    try {
      const payload = {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity: activity || null
        },
        nonce: crypto.randomUUID()
      };

      const actStr = JSON.stringify(payload);
      const actBuf = Buffer.alloc(8 + Buffer.byteLength(actStr));
      actBuf.writeInt32LE(1, 0); // Opcode 1 = FRAME
      actBuf.writeInt32LE(Buffer.byteLength(actStr), 4);
      actBuf.write(actStr, 8, 'utf-8');
      this.socket.write(actBuf);
    } catch (e) {
      console.warn('[DiscordRPC] Error sending activity:', e.message);
    }
  }

  clearActivity() {
    this.lastActivity = null;
    this.sendActivity(null);
  }

  setBrowsing(mediaStats) {
    if (!this.enabled) return;
    const statsStr = mediaStats
      ? `${mediaStats.movies || 0} Movies • ${mediaStats.series || 0} Series`
      : 'Browsing Media';

    this.setActivity({
      type: 3, // WATCHING
      details: 'Browsing Library',
      state: statsStr,
      timestamps: {
        start: this.appStartTime
      },
      assets: {
        large_image: APP_ICON_URL,
        large_text: 'NetFlixxy',
        small_image: APP_ICON_URL,
        small_text: 'NetFlixxy'
      },
      instance: false
    });
  }

  async updatePlayback({ item, episode, isPlaying, currentTime, duration }) {
    if (!this.enabled) return;
    if (!item) {
      this.clearActivity();
      return;
    }

    const isSeries = item.type === 'series' || item.type === 'anime';
    const title = item.title || 'Untitled';
    let details = title;
    let state = '';

    if (isSeries) {
      if (episode && episode.season != null && episode.episode != null) {
        const s = String(episode.season).padStart(2, '0');
        const e = String(episode.episode).padStart(2, '0');
        const epTitle = (episode.title && episode.title !== episode.rawName && episode.title !== `Episode ${episode.episode}`)
          ? ` - ${episode.title}`
          : '';
        state = `S${s}E${e}${epTitle}`;
      } else {
        state = 'Watching Series';
      }
      if (!isPlaying) {
        state += ' (Paused)';
      }
    } else {
      if (item.year) details = `${title} (${item.year})`;
      state = isPlaying ? 'Watching Movie' : 'Watching Movie (Paused)';
    }

    let timestamps;
    if (isPlaying && duration > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const startSec = nowSec - Math.floor(currentTime || 0);
      const endSec = startSec + Math.floor(duration);
      timestamps = { start: startSec, end: endSec };
    }

    // Resolve show/movie poster for large_image
    const posterUrl = await this.fetchOnlinePoster(item.title, item.type);

    this.setActivity({
      type: 3, // WATCHING (renders live timeline progress bar on Discord)
      details,
      state,
      timestamps,
      assets: {
        large_image: posterUrl || APP_ICON_URL,
        large_text: title,
        small_image: APP_ICON_URL,
        small_text: 'NetFlixxy'
      },
      instance: true
    });
  }

  destroy() {
    this.disconnect();
    this.posterCache.clear();
  }
}

export const discordRPC = new DiscordRPC();
