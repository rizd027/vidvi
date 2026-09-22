import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, createReadStream, unlink, statSync } from 'fs';
import { Readable } from 'stream';

const execFileAsync = promisify(execFile);

// Prevent unhandled stream errors from crashing the whole server
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught Exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Rejection (server kept alive):', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Path to bundled yt-dlp binary
const YTDLP_PATH = path.join(__dirname, 'yt-dlp.exe');
const HAS_YTDLP = existsSync(YTDLP_PATH);

// Helper to find ffmpeg binary in common locations
function findFfmpegPath() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localApp = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';
  const candidates = [
    path.join(__dirname, 'ffmpeg.exe'),
    path.join(__dirname, 'bin', 'ffmpeg.exe'),
    path.join(localApp, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    path.join(userProfile, 'scoop', 'shims', 'ffmpeg.exe'),
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\ffmpeg.exe'
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// Working Cobalt instances (tested & verified)
const COBALT_INSTANCES = [
  'https://kitty.tame.gg',
  'https://api.cobalt.liubquanti.click',
];

app.use(cors());
app.use(express.json());

// ─── SQLite Initialization ─────────────────────────────────────────────────
let db;
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'downloads.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      thumbnail TEXT,
      duration TEXT,
      download_url TEXT,
      media_type TEXT,
      size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  console.log('SQLite Database initialized successfully.');
}

initDb().catch((err) => {
  console.error('Failed to initialize database:', err);
});

// ─── Localization ─────────────────────────────────────────────────────────
const messages = {
  en: {
    urlRequired: 'URL query parameter is required',
    invalidPlatform: 'Invalid platform.',
    searchNotSupported: 'Search links are not supported. Please paste a direct media link.',
    photoNotSupported: 'Photos/slideshows are not supported. Only videos and audio are supported.',
    profileNotSupported: 'Profile links are not supported. Please paste a direct video link.',
    playlistNotSupported: 'Playlist/album links are not supported. Please paste a direct song link.',
    invalidTiktokUrl: 'Please provide a valid TikTok video or audio link.',
    invalidSpotifyUrl: 'Please provide a valid Spotify track link.',
    invalidCapcutUrl: 'Please provide a valid CapCut template link.',
    invalidYoutubeUrl: 'Please provide a valid YouTube video link.',
    invalidInstagramUrl: 'Please provide a valid Instagram post, reel or video link.',
    invalidFacebookUrl: 'Please provide a valid Facebook video link.',
    invalidTwitterUrl: 'Please provide a valid Twitter/X post link.',
    fetchFailed: 'Failed to fetch media. Please try a different link.',
  },
  id: {
    urlRequired: 'Parameter query URL wajib diisi',
    invalidPlatform: 'Platform tidak valid.',
    searchNotSupported: 'Tautan pencarian tidak didukung. Harap masukkan tautan media langsung.',
    photoNotSupported: 'Tautan foto/slideshow tidak didukung. Hanya mendukung video dan audio.',
    profileNotSupported: 'Tautan profil tidak didukung. Harap masukkan tautan video langsung.',
    playlistNotSupported: 'Tautan playlist/album tidak didukung. Harap masukkan tautan lagu langsung.',
    invalidTiktokUrl: 'Harap berikan tautan video atau audio TikTok yang valid.',
    invalidSpotifyUrl: 'Harap berikan tautan lagu Spotify yang valid.',
    invalidCapcutUrl: 'Harap berikan tautan templat CapCut yang valid.',
    invalidYoutubeUrl: 'Harap berikan tautan video YouTube yang valid.',
    invalidInstagramUrl: 'Harap berikan tautan postingan, reel, atau video Instagram yang valid.',
    invalidFacebookUrl: 'Harap berikan tautan video Facebook yang valid.',
    invalidTwitterUrl: 'Harap berikan tautan postingan Twitter/X yang valid.',
    fetchFailed: 'Gagal mengambil media. Silakan coba tautan lain.',
  }
};

// ─── Resolve Short URL Redirects ───────────────────────────────────────────
async function resolveUrl(url) {
  try {
    const urlLower = url.toLowerCase();
    const needsResolve = ['tiktok.com', 'capcut.com', 'capcut.net', 'youtu.be', 'fb.watch', 't.co'].some(d => urlLower.includes(d));
    if (!needsResolve) return url;

    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!res.ok) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
      });
    }
    return res.url;
  } catch (err) {
    console.error('URL resolution failed:', err.message);
    return url;
  }
}

// ─── Platform Validation ──────────────────────────────────────────────────
function validateUrl(platform, url, lang = 'id') {
  const t = messages[lang] || messages['en'];
  const u = url.toLowerCase();

  switch (platform) {
    case 'tiktok': {
      const isSearch = u.includes('/search') || u.includes('q=') || u.includes('keywords=');
      const hasPhoto = u.includes('/photo/');
      const hasAt = u.includes('/@');
      const hasVideo = u.includes('/video/');
      const hasMusic = u.includes('/music/');
      const isShort = u.includes('vt.tiktok.com') || u.includes('vm.tiktok.com') || u.includes('/t/');
      if (hasAt && !hasVideo && !hasMusic && !hasPhoto && !isSearch && !isShort) return t.profileNotSupported;
      if (!isShort && !hasVideo && !hasMusic && !hasPhoto && !isSearch && !u.includes('/v/')) return t.invalidTiktokUrl;
      return null;
    }
    case 'spotify': {
      if (u.includes('/playlist/') || u.includes('/album/') || u.includes('/artist/')) return t.playlistNotSupported;
      if (!u.includes('/track/') && !u.includes('/embed/')) return t.invalidSpotifyUrl;
      return null;
    }
    case 'capcut': {
      const isCapcutDomain = u.includes('capcut.com') || u.includes('capcut.net');
      const hasTemplate = u.includes('template') || u.includes('/tv2/') || u.includes('/t/');
      if (!isCapcutDomain || !hasTemplate) return t.invalidCapcutUrl;
      return null;
    }
    case 'youtube': {
      const isYt = u.includes('youtube.com') || u.includes('youtu.be');
      if (!isYt) return t.invalidYoutubeUrl;
      if (u.includes('/channel/') || u.includes('/user/') || u.includes('/@')) {
        if (!u.includes('/watch') && !u.includes('/shorts/') && !u.includes('/live/')) return t.profileNotSupported;
      }
      if (u.includes('/playlist?') || (u.includes('list=') && !u.includes('watch'))) return t.playlistNotSupported;
      return null;
    }
    case 'instagram': {
      const isIg = u.includes('instagram.com');
      if (!isIg) return t.invalidInstagramUrl;
      if (u.match(/instagram\.com\/[^/]+\/?$/) && !u.includes('/p/') && !u.includes('/reel/') && !u.includes('/tv/')) return t.profileNotSupported;
      return null;
    }
    case 'facebook': {
      const isFb = u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com');
      if (!isFb) return t.invalidFacebookUrl;
      return null;
    }
    case 'twitter': {
      const isTw = u.includes('twitter.com') || u.includes('x.com');
      if (!isTw) return t.invalidTwitterUrl;
      if (!u.includes('/status/')) return t.invalidTwitterUrl;
      return null;
    }
    default:
      return null;
  }
}

// ─── Cobalt API Helper ─────────────────────────────────────────────────────
async function fetchViaCobalt(url) {
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      const res = await fetch(`${instance}/`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, downloadMode: 'auto', filenameStyle: 'basic' }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      console.log(`Cobalt ${instance} response:`, JSON.stringify(data).slice(0, 200));

      if (data.status === 'error' || data.error) continue;

      if (data.url || data.tunnel) {
        return { url: data.url || data.tunnel, filename: data.filename };
      }
      if (data.picker && data.picker.length > 0) {
        return { url: data.picker[0].url, picker: data.picker, filename: data.filename };
      }
      if (data.status === 'stream' && data.url) {
        return { url: data.url, filename: data.filename };
      }
    } catch (e) {
      console.warn(`Cobalt ${instance} failed:`, e.message);
    }
  }
  return null;
}

// ─── yt-dlp Helper ────────────────────────────────────────────────────────
async function fetchViaYtdlp(url, opts = {}) {
  if (!HAS_YTDLP) throw new Error('yt-dlp not available');

  const args = [
    '--no-playlist',
    '--skip-download',
    '--dump-json',
    '--no-warnings',
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    url
  ];

  if (opts.cookiesBrowser) {
    args.splice(0, 0, '--cookies-from-browser', opts.cookiesBrowser);
  }

  try {
    const { stdout } = await execFileAsync(YTDLP_PATH, args, {
      timeout: 30000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });

    const lines = stdout.trim().split('\n');
    const json = JSON.parse(lines[lines.length - 1]);
    return json;
  } catch (e) {
    const errMsg = (e.stderr || e.stdout || e.message || '').toString();
    throw new Error(errMsg.slice(0, 300));
  }
}

// ─── YouTube Handler ───────────────────────────────────────────────────────
async function handleYoutube(url) {
  // Primary: yt-dlp (best quality metadata)
  try {
    const json = await fetchViaYtdlp(url);
    const allFormats = json.formats || [];

    // ── Video formats (muxed or video-only with audio available) ──
    // Collect all unique resolutions from muxed (has video+audio) and video-only streams
    const muxedFormats = allFormats.filter(f => f.url && f.vcodec !== 'none' && f.acodec !== 'none' && f.height);
    const videoOnlyFormats = allFormats.filter(f => f.url && f.vcodec !== 'none' && f.acodec === 'none' && f.height);

    // Build deduplicated resolution map: prefer muxed over video-only
    const resolutionMap = {};
    // Add video-only first (lower priority)
    for (const f of videoOnlyFormats) {
      const key = f.height;
      if (!resolutionMap[key] || (f.vbr || f.tbr || 0) > (resolutionMap[key].vbr || resolutionMap[key].tbr || 0)) {
        resolutionMap[key] = f;
      }
    }
    // Override with muxed (higher priority)
    for (const f of muxedFormats) {
      const key = f.height;
      if (!resolutionMap[key] || (f.vbr || f.tbr || 0) > (resolutionMap[key].vbr || resolutionMap[key].tbr || 0)) {
        resolutionMap[key] = f;
      }
    }

    // Sort by resolution descending
    const videoFormats = Object.values(resolutionMap)
      .sort((a, b) => (b.height || 0) - (a.height || 0))
      .map(f => ({
        quality: f.height ? `${f.height}p` : (f.format_note || 'auto'),
        height: f.height || 0,
        url: f.url,
        ext: f.ext || 'mp4',
        hasAudio: f.acodec !== 'none',
        filesize: f.filesize || f.filesize_approx || null,
        vbr: f.vbr || f.tbr || null,
        formatId: f.format_id
      }));

    // ── Audio formats ──
    const allAudio = allFormats.filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.url);
    const seenAudioExt = new Set();
    const audioFormats = allAudio
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))
      .filter(f => {
        // Keep best of each ext type
        if (!seenAudioExt.has(f.ext)) { seenAudioExt.add(f.ext); return true; }
        return false;
      })
      .map(f => ({
        label: f.ext === 'm4a' ? `M4A (AAC)${f.abr ? ` ~${Math.round(f.abr)}kbps` : ''}` :
               f.ext === 'webm' ? `WebM (Opus)${f.abr ? ` ~${Math.round(f.abr)}kbps` : ''}` :
               `${(f.ext || 'audio').toUpperCase()}${f.abr ? ` ~${Math.round(f.abr)}kbps` : ''}`,
        url: f.url,
        ext: f.ext || 'm4a',
        abr: f.abr || 0,
        filesize: f.filesize || f.filesize_approx || null,
        formatId: f.format_id
      }));

    // Best single picks for backwards compat
    const bestVideo = videoFormats[0];
    const m4aAudio = audioFormats.find(f => f.ext === 'm4a') || audioFormats[0];

    return {
      title: json.title || 'YouTube Video',
      author: json.uploader || json.channel || 'YouTube',
      thumbnail: json.thumbnail || '',
      duration: json.duration || 0,
      videoUrl: bestVideo?.url || json.url || '',
      audioUrl: m4aAudio?.url || '',
      audioExt: m4aAudio?.ext || 'm4a',
      views: json.view_count,
      likes: json.like_count,
      videoFormats,
      audioFormats,
      // Legacy field for history store
      formats: videoFormats.slice(0, 5).map(f => ({ quality: f.quality, url: f.url, ext: f.ext }))
    };

  } catch (ytdlpErr) {
    console.warn('yt-dlp failed for YouTube, trying BTCH / Cobalt fallback:', ytdlpErr.message.slice(0, 100));
    // Fallback 1: BTCH / backend1
    try {
      const res = await fetch(`https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status && (data.mp4 || data.mp3)) {
          const videoFormats = data.mp4 ? [{ quality: 'HD / 720p', height: 720, url: data.mp4, ext: 'mp4', hasAudio: true, filesize: null }] : [];
          const audioFormats = data.mp3 ? [{ label: 'Audio MP3', url: data.mp3, ext: 'mp3', abr: 128, filesize: null }] : [];
          return {
            title: data.title || 'YouTube Video',
            author: data.author || 'YouTube',
            thumbnail: data.thumbnail || '',
            duration: 0,
            videoUrl: data.mp4 || '',
            audioUrl: data.mp3 || '',
            audioExt: 'mp3',
            videoFormats,
            audioFormats
          };
        }
      }
    } catch (e) {
      console.warn('BTCH YouTube fallback failed:', e.message);
    }

    // Fallback 2: Cobalt
    const cobalt = await fetchViaCobalt(url);
    if (cobalt) {
      return {
        title: 'YouTube Video',
        author: 'YouTube',
        thumbnail: '',
        duration: 0,
        videoUrl: cobalt.url,
        audioUrl: '',
        videoFormats: [{ quality: 'Best', height: 0, url: cobalt.url, ext: 'mp4', hasAudio: true, filesize: null }],
        audioFormats: [],
      };
    }
    throw new Error('Failed to fetch YouTube video. Please try another link.');
  }
}

// ─── Instagram Handler ─────────────────────────────────────────────────────
async function handleInstagram(url) {
  // Method 1: FastDL API (fast, high reliability, supports reels & carousels)
  try {
    const res = await fetch('https://fastdl.to/api/ajaxSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({ q: url, t: 'media', lang: 'en' }),
      signal: AbortSignal.timeout(12000)
    });
    if (res.ok) {
      const json = await res.json();
      const html = json.data || '';
      const items = [];
      const liMatches = [...html.matchAll(/<div class="download-items">([\s\S]*?)<\/li>/gi)];
      for (const li of liMatches) {
        const content = li[1];
        const thumb = content.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
        const video = content.match(/<a[^>]+href="([^"]+)"[^>]*title="Download Video"/i)?.[1] ||
                      content.match(/<a[^>]+href="([^"]+)"[^>]*title="Download Photo"/i)?.[1];
        if (video) items.push({ thumbnail: thumb, url: video });
      }

      if (items.length === 0) {
        const singleVideo = html.match(/<a[^>]+href="([^"]+)"[^>]*title="Download Video"/i)?.[1] ||
                            html.match(/<a[^>]+href="([^"]+)"[^>]*title="Download Photo"/i)?.[1];
        const singleThumb = html.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
        if (singleVideo) items.push({ thumbnail: singleThumb, url: singleVideo });
      }

      if (items.length > 0) {
        return {
          title: 'Instagram Video',
          author: 'Instagram',
          thumbnail: items[0].thumbnail || '',
          videoUrl: items[0].url,
          picker: items.length > 1 ? items.map((it, idx) => ({ url: it.url, thumbnail: it.thumbnail, index: idx + 1 })) : null,
          duration: 0
        };
      }
    }
  } catch (err) {
    console.warn('FastDL Instagram failed, trying fallback API:', err.message.slice(0, 80));
  }

  // Method 2: BTCH / backend1 API
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.result || data.data || []);
      const validItems = list.filter(item => item && (item.url || item.download_url));
      if (validItems.length > 0) {
        return {
          title: 'Instagram Video',
          author: 'Instagram',
          thumbnail: validItems[0].thumbnail || '',
          videoUrl: validItems[0].url || validItems[0].download_url,
          picker: validItems.length > 1 ? validItems.map((it, idx) => ({ url: it.url || it.download_url, thumbnail: it.thumbnail, index: idx + 1 })) : null,
          duration: 0
        };
      }
    }
  } catch (err) {
    console.warn('BTCH Instagram failed, trying yt-dlp:', err.message.slice(0, 80));
  }

  // Method 3: yt-dlp
  if (HAS_YTDLP) {
    try {
      const json = await fetchViaYtdlp(url);
      const formats = (json.formats || []).filter(f => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'));
      const bestVideo = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none').sort((a, b) => (b.height || 0) - (a.height || 0))[0] || formats[0];
      const videoUrl = bestVideo?.url || json.url || '';
      if (videoUrl) {
        return {
          title: json.title || 'Instagram Video',
          author: json.uploader || 'Instagram',
          thumbnail: json.thumbnail || '',
          duration: json.duration || 0,
          videoUrl,
        };
      }
    } catch (ytdlpErr) {
      console.warn('yt-dlp Instagram failed:', ytdlpErr.message.slice(0, 80));
    }
  }

  // Method 4: Cobalt fallback
  const cobalt = await fetchViaCobalt(url);
  if (cobalt) {
    return {
      title: 'Instagram Video',
      author: 'Instagram',
      thumbnail: '',
      duration: 0,
      videoUrl: cobalt.url,
      picker: cobalt.picker || null,
    };
  }

  throw new Error('Gagal mengambil video Instagram. Pastikan akun tidak privat dan tautan valid.');
}

// ─── Facebook Handler ──────────────────────────────────────────────────────
async function handleFacebook(url) {
  // Method 1: yt-dlp (primary for local server)
  if (HAS_YTDLP) {
    try {
      const json = await fetchViaYtdlp(url);
      const formats = (json.formats || []).filter(f => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'));
      const bestVideo = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none').sort((a, b) => (b.height || 0) - (a.height || 0))[0] || formats[0];
      const videoUrl = bestVideo?.url || json.url || '';
      if (videoUrl) {
        return {
          title: json.title || 'Facebook Video',
          author: json.uploader || 'Facebook',
          thumbnail: json.thumbnail || '',
          duration: json.duration || 0,
          videoUrl,
        };
      }
    } catch (err) {
      console.warn('yt-dlp Facebook failed, trying API fallback:', err.message.slice(0, 80));
    }
  }

  // Method 2: BTCH / backend1 API
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/fbdown?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      let videoUrl = data.HD || data.Normal_video;
      if (videoUrl) {
        // Decode direct fbcdn URL if tokenized
        if (videoUrl.includes('token=')) {
          try {
            const token = videoUrl.match(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/)?.[1];
            if (token) {
              const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
              if (payload.url && payload.url.startsWith('http')) {
                videoUrl = payload.url;
              }
            }
          } catch {}
        }

        return {
          title: data.title || 'Facebook Video',
          author: 'Facebook',
          thumbnail: '',
          duration: 0,
          videoUrl
        };
      }
    }
  } catch (err) {
    console.warn('BTCH Facebook failed:', err.message.slice(0, 80));
  }

  // Method 3: Cobalt fallback
  const cobalt = await fetchViaCobalt(url);
  if (cobalt) {
    return {
      title: 'Facebook Video',
      author: 'Facebook',
      thumbnail: '',
      duration: 0,
      videoUrl: cobalt.url,
    };
  }

  throw new Error('Gagal mengambil video Facebook. Pastikan video bersifat publik.');
}

// ─── Twitter Handler ───────────────────────────────────────────────────────
async function handleTwitter(url) {
  // Method 1: yt-dlp (primary for local server)
  if (HAS_YTDLP) {
    try {
      const json = await fetchViaYtdlp(url);
      const formats = (json.formats || []).filter(f => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'));
      const bestVideo = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none').sort((a, b) => (b.height || 0) - (a.height || 0))[0] || formats[0];
      const videoUrl = bestVideo?.url || json.url || '';
      if (videoUrl) {
        return {
          title: json.title || json.fulltitle || 'Twitter/X Video',
          author: json.uploader || 'Twitter User',
          thumbnail: json.thumbnail || '',
          duration: json.duration || 0,
          videoUrl,
        };
      }
    } catch (err) {
      console.warn('yt-dlp Twitter failed, trying API fallback:', err.message.slice(0, 80));
    }
  }

  // Method 2: BTCH / backend1 API
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/twitter?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      const urls = Array.isArray(data.url) ? data.url : [];
      const bestUrl = urls[0]?.hd || urls[0]?.sd || urls[1]?.hd || urls[1]?.sd || (typeof data.url === 'string' ? data.url : '');
      if (bestUrl) {
        return {
          title: data.title || 'Twitter/X Video',
          author: 'Twitter User',
          thumbnail: '',
          duration: 0,
          videoUrl: bestUrl
        };
      }
    }
  } catch (err) {
    console.warn('BTCH Twitter failed:', err.message.slice(0, 80));
  }

  // Method 3: fxtwitter embed API
  const tweetId = url.match(/status\/(\d+)/)?.[1];
  if (tweetId) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.tweet?.media?.videos?.length > 0) {
          const video = json.tweet.media.videos[0];
          return {
            title: json.tweet.text || 'Twitter/X Video',
            author: json.tweet.author?.name || 'Twitter User',
            thumbnail: json.tweet.media.videos[0].thumbnail_url || '',
            videoUrl: video.variants?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]?.url || video.url || '',
            duration: 0
          };
        }
      }
    } catch (err) {
      console.warn('fxtwitter failed:', err.message.slice(0, 80));
    }
  }

  // Method 4: Cobalt fallback
  const cobalt = await fetchViaCobalt(url);
  if (cobalt) {
    return {
      title: 'Twitter/X Video',
      author: 'Twitter/X',
      thumbnail: '',
      duration: 0,
      videoUrl: cobalt.url,
    };
  }

  throw new Error('Gagal mengambil video Twitter/X. Pastikan postingan memiliki video dan tidak dikunci.');
}

// ─── TikTok Handler ────────────────────────────────────────────────────────
async function handleTikTok(url, resolvedUrl, lang) {
  const t = messages[lang] || messages['en'];

  // Handle TikTok search
  const urlLower = url.toLowerCase();
  const resolvedUrlLower = resolvedUrl.toLowerCase();
  const isSearch = urlLower.includes('/search') || urlLower.includes('q=') || resolvedUrlLower.includes('/search') || resolvedUrlLower.includes('q=');

  if (isSearch) {
    let query = '';
    try { query = new URL(url).searchParams.get('q'); } catch {}
    if (!query) try { query = new URL(resolvedUrl).searchParams.get('q'); } catch {}

    if (query) {
      const searchApiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}`;
      const response = await fetch(searchApiUrl);
      const data = await response.json();
      if (data.code === 0 && data.data?.videos?.length > 0) {
        const v = data.data.videos[0];
        return {
          tiktok: true,
          title: v.title || `TikTok Video by @${v.author?.unique_id}`,
          author: { nickname: v.author?.unique_id || 'TikTok User' },
          cover: v.cover || '',
          video: v.play || '',
          video_watermark: v.wmplay || '',
          audio: v.music_info?.play || v.music_info?.url || '',
          duration: v.duration || '',
          images: []
        };
      }
    }
    throw new Error(t.searchNotSupported);
  }

  // BintangAPI primary
  try {
    const apiUrl = `https://bintangapi.my.id/api/downloader/tiktok?url=${encodeURIComponent(resolvedUrl)}`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success !== false && data.data) {
        const bData = data.data;
        const username = bData.user?.username || 'TikTok User';
        return {
          tiktok: true,
          title: bData.title || `TikTok Video by @${username}`,
          author: { nickname: username },
          cover: bData.thumbnail || '',
          video: bData.video_no_watermark?.url || '',
          video_watermark: bData.video_watermark?.url || '',
          audio: bData.audio_url || bData.music_url || '',
          duration: bData.duration || '',
          images: bData.images || []
        };
      }
    }
  } catch (e) {
    console.warn('BintangAPI TikTok failed:', e.message.slice(0, 80));
  }

  // Tikwm fallback
  const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}`;
  const tikwmResponse = await fetch(tikwmApiUrl);
  const tikwmData = await tikwmResponse.json();
  if (tikwmData.code === 0 && tikwmData.data) {
    const tData = tikwmData.data;
    const username = tData.author?.unique_id || 'TikTok User';
    const isSlideshow = tData.images?.length > 0;
    return {
      tiktok: true,
      title: tData.title || `TikTok Video by @${username}`,
      author: { nickname: username },
      cover: tData.cover || '',
      video: isSlideshow ? '' : (tData.play || ''),
      video_watermark: isSlideshow ? '' : (tData.wmplay || ''),
      audio: tData.music_info?.play || tData.music_info?.url || '',
      duration: tData.duration || '',
      images: isSlideshow ? (tData.images || []) : []
    };
  }

  // Cobalt audio-mode fallback
  try {
    for (const instance of COBALT_INSTANCES) {
      try {
        const res = await fetch(`${instance}/`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: resolvedUrl, downloadMode: 'audio', filenameStyle: 'basic' }),
          signal: AbortSignal.timeout(12000),
        });
        const cobaltData = await res.json();
        if ((cobaltData.url || cobaltData.tunnel) && cobaltData.status !== 'error') {
          return {
            tiktok: true,
            title: 'TikTok Video',
            author: { nickname: 'TikTok User' },
            cover: '',
            video: '',
            video_watermark: '',
            audio: cobaltData.url || cobaltData.tunnel,
            duration: '',
            images: []
          };
        }
      } catch (e) { /* continue */ }
    }
  } catch (e) { /* skip */ }

  throw new Error('Failed to fetch TikTok video. Please try another link.');
}

// ─── Main Download Route ───────────────────────────────────────────────────
const SUPPORTED_PLATFORMS = ['capcut', 'spotify', 'tiktok', 'youtube', 'instagram', 'facebook', 'twitter'];

app.get('/api/download/:platform', async (req, res) => {
  const { platform } = req.params;
  const { url, lang = 'id' } = req.query;
  const t = messages[lang] || messages['en'];

  if (!url) return res.status(400).json({ status: false, message: t.urlRequired });
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return res.status(400).json({ status: false, message: t.invalidPlatform });
  }

  // Pre-resolution validation
  let validationError = validateUrl(platform, url, lang);
  if (validationError) return res.status(200).json({ status: false, message: validationError });

  // Resolve short URLs
  const resolvedUrl = await resolveUrl(url);

  // Post-resolution validation
  validationError = validateUrl(platform, resolvedUrl, lang);
  if (validationError) return res.status(200).json({ status: false, message: validationError });

  try {
    let result = {};
    let dbTitle = '', dbThumbnail = '', dbDownloadUrl = '', dbDuration = '', dbSize = 'Unknown', mediaType = 'video';

    // ── Spotify ──
    if (platform === 'spotify') {
      const apiUrl = `https://bintangapi.my.id/api/downloader/spotify?url=${encodeURIComponent(resolvedUrl)}`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await response.json();
      if (!data.success && !data.data) throw new Error(data.error || t.fetchFailed);
      const bData = data.data;
      result = {
        title: bData.title || 'Spotify Track',
        artist: bData.artist || 'Unknown Artist',
        album: bData.album || '',
        thumbnail: bData.cover_url || '',
        downloadUrl: bData.download_url || '',
        duration: bData.duration || ''
      };
      dbTitle = result.title; dbThumbnail = result.thumbnail;
      dbDownloadUrl = result.downloadUrl; dbDuration = result.duration; mediaType = 'audio';
    }

    // ── CapCut ──
    else if (platform === 'capcut') {
      const apiUrl = `https://bintangapi.my.id/api/downloader/capcut?url=${encodeURIComponent(resolvedUrl)}`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await response.json();
      if (!data.success && !data.data) throw new Error(data.error || t.fetchFailed);
      const bData = data.data;
      result = {
        title: bData.title || 'CapCut Template',
        cover: bData.download_cover || '',
        video: bData.download_video || '',
        size: bData.size || ''
      };
      dbTitle = result.title; dbThumbnail = result.cover;
      dbDownloadUrl = result.video; dbSize = result.size || 'Unknown';
    }

    // ── TikTok ──
    else if (platform === 'tiktok') {
      const tResult = await handleTikTok(url, resolvedUrl, lang);
      result = tResult;
      dbTitle = result.title; dbThumbnail = result.cover;
      dbDownloadUrl = result.video || result.audio; dbDuration = result.duration?.toString() || '';
    }

    // ── YouTube ──
    else if (platform === 'youtube') {
      const ytResult = await handleYoutube(resolvedUrl);
      result = ytResult;
      dbTitle = result.title; dbThumbnail = result.thumbnail;
      dbDownloadUrl = result.videoUrl; dbDuration = result.duration?.toString() || ''; mediaType = 'video';
    }

    // ── Instagram ──
    else if (platform === 'instagram') {
      const igResult = await handleInstagram(resolvedUrl);
      result = igResult;
      dbTitle = result.title; dbThumbnail = result.thumbnail || '';
      dbDownloadUrl = result.videoUrl; dbDuration = result.duration?.toString() || ''; mediaType = 'video';
    }

    // ── Facebook ──
    else if (platform === 'facebook') {
      const fbResult = await handleFacebook(resolvedUrl);
      result = fbResult;
      dbTitle = result.title; dbThumbnail = result.thumbnail || '';
      dbDownloadUrl = result.videoUrl; dbDuration = result.duration?.toString() || ''; mediaType = 'video';
    }

    // ── Twitter ──
    else if (platform === 'twitter') {
      const twResult = await handleTwitter(resolvedUrl);
      result = twResult;
      dbTitle = result.title; dbThumbnail = result.thumbnail || '';
      dbDownloadUrl = result.videoUrl; dbDuration = result.duration?.toString() || ''; mediaType = 'video';
    }

    // History is tracked client-side (localStorage via historyStore) to avoid duplication.
    // SQLite is retained for settings only.

    console.log(`✅ Successfully processed ${platform}: ${dbTitle}`);
    res.json({ status: true, result });
  } catch (error) {
    console.error(`❌ Error processing ${platform}:`, error.message);
    res.status(200).json({ status: false, message: error.message });
  }
});

// ─── History Routes (kept for backwards compat, client uses localStorage) ──
app.get('/api/history', async (req, res) => {
  if (!db) return res.status(503).json({ status: false, message: 'Database not ready yet' });
  try {
    const history = await db.all('SELECT * FROM downloads ORDER BY created_at DESC LIMIT 50');
    res.json({ status: true, data: history });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.delete('/api/history', async (req, res) => {
  if (!db) return res.status(503).json({ status: false, message: 'Database not ready yet' });
  try {
    await db.run('DELETE FROM downloads');
    res.json({ status: true, message: 'All history cleared successfully' });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.delete('/api/history/:id', async (req, res) => {
  if (!db) return res.status(503).json({ status: false, message: 'Database not ready yet' });
  const { id } = req.params;
  try {
    await db.run('DELETE FROM downloads WHERE id = ?', [id]);
    res.json({ status: true, message: `Record ${id} deleted successfully` });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// ─── Settings Routes ───────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  if (!db) return res.status(503).json({ status: false, message: 'Database not ready yet' });
  try {
    const rows = await db.all('SELECT * FROM settings');
    const settingsMap = {};
    rows.forEach((row) => { settingsMap[row.key] = row.value; });
    res.json({ status: true, data: settingsMap });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  if (!db) return res.status(503).json({ status: false, message: 'Database not ready yet' });
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ status: false, message: 'Key and value are required' });
  }
  try {
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
    res.json({ status: true, message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// ─── YouTube Tools Status Route ───────────────────────────────────────────
app.get('/api/youtube/status', async (req, res) => {
  const ffmpegLocation = findFfmpegPath();
  let hasFfmpeg = !!ffmpegLocation;

  if (!hasFfmpeg) {
    try {
      await execFileAsync('ffmpeg', ['-version']);
      hasFfmpeg = true;
    } catch {
      hasFfmpeg = false;
    }
  }

  res.json({
    status: true,
    hasYtdlp: HAS_YTDLP,
    hasFfmpeg,
    ffmpegPath: ffmpegLocation || (hasFfmpeg ? 'PATH' : null)
  });
});

// ─── YouTube MP3 Conversion Route ─────────────────────────────────────────
// Uses a temp file strategy: yt-dlp writes the converted MP3 to a temp file,
// then the server streams the file to the browser and deletes it on finish.
// This is more reliable than -o - (piping to stdout) because ffmpeg postprocessors
// require a real file path — piping is not supported for format conversion.
app.get('/api/youtube/mp3', async (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ status: false, message: 'url is required' });
  if (!HAS_YTDLP) return res.status(503).json({ status: false, message: 'yt-dlp tidak tersedia di server ini.' });

  // Verify ffmpeg availability upfront before starting conversion
  const ffmpegLocation = findFfmpegPath();
  if (!ffmpegLocation) {
    let hasSystemFfmpeg = false;
    try {
      await execFileAsync('ffmpeg', ['-version']);
      hasSystemFfmpeg = true;
    } catch {}
    if (!hasSystemFfmpeg) {
      return res.status(422).json({
        status: false,
        message: 'ffmpeg tidak ditemukan di server. Install ffmpeg untuk mengaktifkan konversi MP3.'
      });
    }
  }

  const decodedUrl = decodeURIComponent(url);
  const safeTitle = (title ? decodeURIComponent(title) : 'youtube-audio')
    .replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_').slice(0, 120);
  const filename = `${safeTitle}.mp3`;
  const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');
  const encodedName = encodeURIComponent(filename);

  // Temp file path — yt-dlp writes here, we stream it, then delete it
  const tmpId = `vidvi_mp3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpBase = path.join(os.tmpdir(), tmpId);
  // yt-dlp will append .mp3 itself, so pass base path without extension
  const tmpFile = `${tmpBase}.mp3`;

  console.log(`🎵 MP3 conversion started: ${decodedUrl.slice(0, 80)}`);

  const args = [
    '--no-playlist',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-warnings'
  ];

  if (ffmpegLocation) {
    args.push('--ffmpeg-location', ffmpegLocation);
  }

  args.push('-o', tmpBase + '.%(ext)s', decodedUrl);

  let errorBuffer = '';

  const ytdlpProcess = spawn(YTDLP_PATH, args, { windowsHide: true });

  ytdlpProcess.stderr.on('data', (data) => { errorBuffer += data.toString(); });
  ytdlpProcess.stdout.on('data', () => {});   // drain stdout to prevent blocking

  ytdlpProcess.on('error', (err) => {
    console.error('yt-dlp spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: false, message: 'Gagal memulai konversi MP3: ' + err.message });
    }
  });

  ytdlpProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp MP3 failed (code ${code}):`, errorBuffer.slice(0, 300));

      // Give user a friendly error message
      let userMsg = 'Konversi MP3 gagal.';
      const errLower = errorBuffer.toLowerCase();
      if (errLower.includes('ffmpeg') && errLower.includes('not found')) {
        userMsg = 'ffmpeg tidak ditemukan di server. Install ffmpeg untuk mengaktifkan konversi MP3.';
      } else if (errLower.includes('403') || errLower.includes('forbidden')) {
        userMsg = 'YouTube memblokir permintaan ini. Coba lagi nanti atau gunakan unduhan audio langsung.';
      } else if (errLower.includes('sign in') || errLower.includes('age')) {
        userMsg = 'Video membutuhkan login atau verifikasi umur dan tidak bisa diunduh.';
      } else if (errLower.includes('private')) {
        userMsg = 'Video ini bersifat privat dan tidak dapat diunduh.';
      }

      if (!res.headersSent) {
        return res.status(422).json({ status: false, message: userMsg });
      }
      return;
    }

    // Verify the output file exists and is not empty
    let fileSize = 0;
    try {
      fileSize = statSync(tmpFile).size;
    } catch {
      if (!res.headersSent) {
        return res.status(500).json({ status: false, message: 'File MP3 tidak ditemukan setelah konversi. Pastikan ffmpeg terinstall.' });
      }
      return;
    }

    if (fileSize === 0) {
      unlink(tmpFile, () => {});
      if (!res.headersSent) {
        return res.status(500).json({ status: false, message: 'File MP3 kosong. Konversi gagal.' });
      }
      return;
    }

    console.log(`✅ MP3 ready (${Math.round(fileSize / 1024)}KB), streaming: ${filename}`);

    // Stream the converted file to the browser
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'no-cache');

    const fileStream = createReadStream(tmpFile);

    fileStream.on('error', (err) => {
      console.error('File stream error:', err.message);
      if (!res.writableEnded) res.end();
    });

    fileStream.on('close', () => {
      // Delete temp file after streaming completes
      unlink(tmpFile, (err) => {
        if (err) console.warn('Failed to delete temp MP3:', err.message);
      });
    });

    // Abort stream if client disconnects early
    req.on('close', () => fileStream.destroy());

    fileStream.pipe(res);
  });

  // Kill yt-dlp if client disconnects during conversion
  req.on('close', () => {
    if (!ytdlpProcess.killed) {
      ytdlpProcess.kill();
      // Cleanup temp file if it exists
      try { unlink(tmpFile, () => {}); } catch {}
    }
  });
});


// ─── Proxy Download Route ──────────────────────────────────────────────────
// Streams a remote URL through the server so the browser triggers a real
// "Save file" dialog instead of opening a new tab.
app.get('/api/proxy-download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ status: false, message: 'url is required' });

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log(`⬇️  Proxy download: ${decodedUrl.slice(0, 80)}...`);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
    };

    // Forward Range header for resume support
    if (req.headers['range']) {
      headers['Range'] = req.headers['range'];
    }

    // Set correct Referer based on CDN origin
    const u = decodedUrl.toLowerCase();
    if (u.includes('googlevideo.com') || u.includes('youtube.com')) {
      headers['Referer'] = 'https://www.youtube.com/';
      headers['Origin'] = 'https://www.youtube.com';
    } else if (u.includes('tiktokcdn.com') || u.includes('tiktok.com') || u.includes('muscdn.com')) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
    } else if (u.includes('snapcdn.app')) {
      headers['Referer'] = 'https://fastdl.to/';
      headers['Origin'] = 'https://fastdl.to';
    } else if (u.includes('rapidcdn.app')) {
      headers['User-Agent'] = 'TelegramBot (like TwitterBot)';
    } else if (u.includes('cdninstagram.com') || u.includes('instagram.com')) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
    } else if (u.includes('fbcdn.net') || u.includes('facebook.com') || u.includes('fbwat.ch')) {
      headers['Referer'] = 'https://www.facebook.com/';
      headers['User-Agent'] = 'facebookexternalhit/1.1';
    } else if (u.includes('twitter.com') || u.includes('twimg.com') || u.includes('x.com')) {
      headers['Referer'] = 'https://x.com/';
    } else {
      try {
        const parsedUrl = new URL(decodedUrl);
        headers['Referer'] = parsedUrl.origin + '/';
      } catch (e) {
        headers['Referer'] = 'https://www.google.com/';
      }
    }

    const upstream = await fetch(decodedUrl, {
      headers,
      signal: AbortSignal.timeout(60000),
    });

    if (!upstream.ok) {
      console.error(`Upstream ${upstream.status} for: ${decodedUrl.slice(0, 120)}`);
      return res.status(upstream.status).json({ status: false, message: `Upstream returned ${upstream.status}: ${upstream.statusText}` });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    // Determine a safe filename
    let safeFilename = filename
      ? decodeURIComponent(filename)
      : 'download';

    // Strip query strings from filename if needed
    safeFilename = safeFilename.split('?')[0];

    // Correct extension based on actual content-type from upstream
    // This fixes cases where yt-dlp audio is M4A but caller requested .mp3
    const extMap = {
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/webm': 'webm',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/x-matroska': 'mkv',
    };
    const detectedExt = Object.entries(extMap).find(([mime]) => contentType.startsWith(mime))?.[1];

    // Only add extension if completely missing — never override a valid extension the caller provided
    if (!safeFilename.includes('.')) {
      safeFilename += '.' + (detectedExt || 'mp4');
    }

    res.setHeader('Content-Type', contentType);
    // Forward upstream range response status
    if (upstream.status === 206) {
      res.status(206);
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      res.setHeader('Accept-Ranges', 'bytes');
    }
    if (req.query.inline === 'true') {
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      // Use RFC 5987 encoding to safely handle unicode filenames (CJK, Arabic, etc.)
      const asciiName = safeFilename.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_').replace(/"/g, '');
      const encodedName = encodeURIComponent(safeFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control', 'no-cache');
    }
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream the upstream body to the Express response using Node.js Readable
    // This is more stable than Web Streams pipeTo() which can crash the process on timeout
    const nodeStream = Readable.fromWeb(upstream.body);

    nodeStream.on('error', (err) => {
      console.error('Proxy stream error:', err.message);
      if (!res.writableEnded) res.end();
    });

    req.on('close', () => {
      nodeStream.destroy();
    });

    nodeStream.pipe(res);
  } catch (error) {
    console.error('Proxy download error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ status: false, message: 'Proxy download failed: ' + error.message });
    }
  }
});
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ status: false, message: 'API endpoint not found' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 yt-dlp: ${HAS_YTDLP ? '✅ available' : '❌ not found'}`);
});
