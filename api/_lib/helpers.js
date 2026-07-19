// ─── Shared helpers for Vercel Serverless Functions ────────────────────────
// Extracted from server.js — no yt-dlp (not available on Vercel/Linux)

// ─── Localization ─────────────────────────────────────────────────────────
export const messages = {
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
export async function resolveUrl(url) {
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
export function validateUrl(platform, url, lang = 'id') {
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

// ─── Working Cobalt Instances ──────────────────────────────────────────────
const COBALT_INSTANCES = [
  'https://kitty.tame.gg',
  'https://api.cobalt.liubquanti.click',
];

// ─── Cobalt API Helper ─────────────────────────────────────────────────────
export async function fetchViaCobalt(url, mode = 'auto') {
  for (const instance of COBALT_INSTANCES) {
    try {
      const res = await fetch(`${instance}/`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, downloadMode: mode, filenameStyle: 'basic' }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
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

// ─── YouTube Handler (Cobalt only — no yt-dlp on Vercel) ──────────────────
export async function handleYoutube(url) {
  const cobalt = await fetchViaCobalt(url, 'auto');
  if (cobalt) {
    return {
      title: 'YouTube Video',
      author: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${extractYoutubeId(url)}/hqdefault.jpg`,
      duration: 0,
      videoUrl: cobalt.url,
      audioUrl: '',
    };
  }
  throw new Error('Gagal mengambil video YouTube. Coba tautan lain atau gunakan format yang berbeda.');
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').pop() || '';
  } catch {
    return '';
  }
}

// ─── Instagram Handler ─────────────────────────────────────────────────────
export async function handleInstagram(url) {
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

  const scrapers = [
    async () => {
      const res = await fetch('https://snapsave.app/action.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://snapsave.app',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        },
        body: new URLSearchParams({ url }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const text = await res.text();
      const mp4Match = text.match(/https?:\/\/[^"'<>\s]+\.mp4[^"'<>\s]*/);
      if (mp4Match) return { videoUrl: mp4Match[0], title: 'Instagram Video', author: 'Instagram' };
      return null;
    },
    async () => {
      const res = await fetch(`https://v3.saveinsta.app/api/ajaxSearch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://saveinsta.app',
          'User-Agent': 'Mozilla/5.0'
        },
        body: new URLSearchParams({ q: url, t: 'media', lang: 'en' }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.data) {
        const dataStr = JSON.stringify(json.data);
        const mp4Match = dataStr.match(/https?:[^"'<>\s]+\.mp4/);
        if (mp4Match) return { videoUrl: mp4Match[0], title: json.title || 'Instagram Video', author: 'Instagram' };
      }
      return null;
    }
  ];

  for (const scraper of scrapers) {
    try {
      const result = await scraper();
      if (result) return result;
    } catch (e) {
      console.warn('Instagram scraper failed:', e.message.slice(0, 80));
    }
  }
  throw new Error('Gagal mengambil video Instagram.');
}

// ─── Facebook Handler ──────────────────────────────────────────────────────
export async function handleFacebook(url) {
  const cobalt = await fetchViaCobalt(url);
  if (cobalt) {
    return { title: 'Facebook Video', author: 'Facebook', thumbnail: '', duration: 0, videoUrl: cobalt.url };
  }

  try {
    const res = await fetch('https://fdown.net/download.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://fdown.net/',
        'Origin': 'https://fdown.net',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      body: new URLSearchParams({ URLz: url }),
      signal: AbortSignal.timeout(12000)
    });
    if (res.ok) {
      const text = await res.text();
      const hdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>HD/i);
      const sdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>SD/i);
      const anyMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]+\.mp4[^"]*)"/i);
      const videoUrl = hdMatch?.[1] || sdMatch?.[1] || anyMatch?.[1];
      if (videoUrl) return { videoUrl, title: 'Facebook Video', author: 'Facebook' };
    }
  } catch (e) {
    console.warn('Facebook fdown failed:', e.message.slice(0, 80));
  }

  throw new Error('Gagal mengambil video Facebook.');
}

// ─── Twitter Handler ───────────────────────────────────────────────────────
export async function handleTwitter(url) {
  const cobalt = await fetchViaCobalt(url);
  if (cobalt) {
    return { title: 'Twitter/X Video', author: 'Twitter/X', thumbnail: '', duration: 0, videoUrl: cobalt.url };
  }

  const tweetId = url.match(/status\/(\d+)/)?.[1];
  if (!tweetId) throw new Error('Could not extract tweet ID.');

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
          thumbnail: video.thumbnail_url || '',
          videoUrl: video.variants?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]?.url || video.url || '',
          duration: 0
        };
      }
    }
  } catch (e) {
    console.warn('fxtwitter failed:', e.message.slice(0, 80));
  }

  throw new Error('Gagal mengambil video Twitter/X.');
}

// ─── TikTok Handler ────────────────────────────────────────────────────────
export async function handleTikTok(url, resolvedUrl, lang) {
  const t = messages[lang] || messages['en'];
  const urlLower = url.toLowerCase();
  const resolvedUrlLower = resolvedUrl.toLowerCase();
  const isSearch = urlLower.includes('/search') || urlLower.includes('q=') || resolvedUrlLower.includes('/search') || resolvedUrlLower.includes('q=');

  if (isSearch) {
    let query = '';
    try { query = new URL(url).searchParams.get('q'); } catch {}
    if (!query) try { query = new URL(resolvedUrl).searchParams.get('q'); } catch {}
    if (query) {
      const response = await fetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}`);
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
    const response = await fetch(`https://bintangapi.my.id/api/downloader/tiktok?url=${encodeURIComponent(resolvedUrl)}`, {
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
  try {
    const tikwmResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}`);
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
  } catch (e) {
    console.warn('Tikwm failed:', e.message.slice(0, 80));
  }

  // Cobalt audio-mode fallback
  try {
    for (const instance of COBALT_INSTANCES) {
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
          cover: '', video: '', video_watermark: '',
          audio: cobaltData.url || cobaltData.tunnel,
          duration: '', images: []
        };
      }
    }
  } catch (e) { /* skip */ }

  throw new Error('Gagal mengambil video TikTok. Coba tautan lain.');
}
