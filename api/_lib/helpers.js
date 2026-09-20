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
// ⚡ Optimized: added timeout + skip if not a known short domain
export async function resolveUrl(url) {
  try {
    const urlLower = url.toLowerCase();
    const needsResolve = ['vt.tiktok.com', 'vm.tiktok.com', 'capcut.net', 'youtu.be', 'fb.watch', 't.co'].some(d => urlLower.includes(d));
    if (!needsResolve) return url;

    // HEAD request with 4s timeout — fast redirect follow
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
    });
    return res.url || url;
  } catch (err) {
    console.warn('URL resolution failed (using original):', err.message);
    return url; // fallback to original URL on timeout/error
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
// ⚡ Optimized: try ALL instances in PARALLEL, return whichever responds first
export async function fetchViaCobalt(url, mode = 'auto') {
  const tryInstance = async (instance) => {
    const res = await fetch(`${instance}/`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, downloadMode: mode, filenameStyle: 'basic' }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.status === 'error' || data.error) throw new Error('cobalt error');

    if (data.url || data.tunnel) return { url: data.url || data.tunnel, filename: data.filename };
    if (data.picker?.length > 0) return { url: data.picker[0].url, picker: data.picker, filename: data.filename };
    if (data.status === 'stream' && data.url) return { url: data.url, filename: data.filename };
    throw new Error('no media url');
  };

  try {
    // Run all instances in parallel — fastest one wins
    return await Promise.any(COBALT_INSTANCES.map(inst => tryInstance(inst)));
  } catch {
    return null;
  }
}

// ─── YouTube Handler ───────────────────────────────────────────────────────
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
  // ⚡ Optimized: run Cobalt + scrapers in parallel, take first success
  const cobaltPromise = fetchViaCobalt(url).then(r => {
    if (!r) throw new Error('cobalt failed');
    return { title: 'Instagram Video', author: 'Instagram', thumbnail: '', duration: 0, videoUrl: r.url, picker: r.picker || null };
  });

  const snapsavePromise = (async () => {
    const res = await fetch('https://snapsave.app/action.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://snapsave.app',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      body: new URLSearchParams({ url }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('snapsave failed');
    const text = await res.text();
    const mp4Match = text.match(/https?:\/\/[^"'<>\s]+\.mp4[^"'<>\s]*/);
    if (!mp4Match) throw new Error('no mp4');
    return { videoUrl: mp4Match[0], title: 'Instagram Video', author: 'Instagram' };
  })();

  const saveinstaPromise = (async () => {
    const res = await fetch(`https://v3.saveinsta.app/api/ajaxSearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://saveinsta.app',
        'User-Agent': 'Mozilla/5.0'
      },
      body: new URLSearchParams({ q: url, t: 'media', lang: 'en' }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('saveinsta failed');
    const json = await res.json();
    if (!json.data) throw new Error('no data');
    const dataStr = JSON.stringify(json.data);
    const mp4Match = dataStr.match(/https?:[^"'<>\s]+\.mp4/);
    if (!mp4Match) throw new Error('no mp4');
    return { videoUrl: mp4Match[0], title: json.title || 'Instagram Video', author: 'Instagram' };
  })();

  try {
    return await Promise.any([cobaltPromise, snapsavePromise, saveinstaPromise]);
  } catch {
    throw new Error('Gagal mengambil video Instagram.');
  }
}

// ─── Facebook Handler ──────────────────────────────────────────────────────
export async function handleFacebook(url) {
  const cobaltPromise = fetchViaCobalt(url).then(r => {
    if (!r) throw new Error('cobalt failed');
    return { title: 'Facebook Video', author: 'Facebook', thumbnail: '', duration: 0, videoUrl: r.url };
  });

  const fdownPromise = (async () => {
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
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error('fdown failed');
    const text = await res.text();
    const hdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>HD/i);
    const sdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>SD/i);
    const anyMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]+\.mp4[^"]*)"/i);
    const videoUrl = hdMatch?.[1] || sdMatch?.[1] || anyMatch?.[1];
    if (!videoUrl) throw new Error('no url');
    return { videoUrl, title: 'Facebook Video', author: 'Facebook' };
  })();

  try {
    return await Promise.any([cobaltPromise, fdownPromise]);
  } catch {
    throw new Error('Gagal mengambil video Facebook.');
  }
}

// ─── Twitter Handler ───────────────────────────────────────────────────────
export async function handleTwitter(url) {
  const tweetId = url.match(/status\/(\d+)/)?.[1];

  const cobaltPromise = fetchViaCobalt(url).then(r => {
    if (!r) throw new Error('cobalt failed');
    return { title: 'Twitter/X Video', author: 'Twitter/X', thumbnail: '', duration: 0, videoUrl: r.url };
  });

  const fxtwitterPromise = tweetId ? (async () => {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('fxtwitter failed');
    const json = await res.json();
    if (!json.tweet?.media?.videos?.length) throw new Error('no video');
    const video = json.tweet.media.videos[0];
    return {
      title: json.tweet.text || 'Twitter/X Video',
      author: json.tweet.author?.name || 'Twitter User',
      thumbnail: video.thumbnail_url || '',
      videoUrl: video.variants?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]?.url || video.url || '',
      duration: 0
    };
  })() : Promise.reject(new Error('no tweet id'));

  try {
    return await Promise.any([cobaltPromise, fxtwitterPromise]);
  } catch {
    throw new Error('Gagal mengambil video Twitter/X.');
  }
}

// ─── TikTok Handler ────────────────────────────────────────────────────────
// ⚡ Optimized: BintangAPI + tikwm run IN PARALLEL — fastest wins
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

  // ⚡ BintangAPI and tikwm run simultaneously — use whichever responds first
  const bintangPromise = (async () => {
    const response = await fetch(`https://bintangapi.my.id/api/downloader/tiktok?url=${encodeURIComponent(resolvedUrl)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('bintangapi http error');
    const data = await response.json();
    if (data.success === false || !data.data) throw new Error('bintangapi no data');
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
  })();

  const tikwmPromise = (async () => {
    const tikwmResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}`, {
      signal: AbortSignal.timeout(8000),
    });
    const tikwmData = await tikwmResponse.json();
    if (tikwmData.code !== 0 || !tikwmData.data) throw new Error('tikwm no data');
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
  })();

  try {
    // Both APIs race — fastest valid response wins
    return await Promise.any([bintangPromise, tikwmPromise]);
  } catch {
    // Both failed — fallback to Cobalt audio-mode
    try {
      const cobalt = await fetchViaCobalt(resolvedUrl, 'audio');
      if (cobalt) {
        return {
          tiktok: true,
          title: 'TikTok Video',
          author: { nickname: 'TikTok User' },
          cover: '', video: '', video_watermark: '',
          audio: cobalt.url,
          duration: '', images: []
        };
      }
    } catch { /* skip */ }

    throw new Error('Gagal mengambil video TikTok. Coba tautan lain.');
  }
}
