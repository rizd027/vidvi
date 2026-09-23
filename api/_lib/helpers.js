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
    const needsResolve = ['vt.tiktok.com', 'vm.tiktok.com', 'capcut.net', 'youtu.be', 'fb.watch', 'fb.me', 't.co', 'spotify.link', 'spoti.fi'].some(d => urlLower.includes(d));
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
      if (u.includes('spotify.link') || u.includes('spoti.fi')) return null;
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
      const isIg = u.includes('instagram.com') || u.includes('instagr.am');
      if (!isIg) return t.invalidInstagramUrl;
      if (u.match(/instagram\.com\/[^/]+\/?$/) && !u.includes('/p/') && !u.includes('/reel/') && !u.includes('/tv/')) return t.profileNotSupported;
      return null;
    }
    case 'facebook': {
      const isFb = u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com') || u.includes('fb.me');
      if (!isFb) return t.invalidFacebookUrl;
      return null;
    }
    case 'twitter': {
      const isTw = u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co');
      if (!isTw) return t.invalidTwitterUrl;
      if (u.includes('t.co')) return null;
      if (!u.includes('/status/')) return t.invalidTwitterUrl;
      return null;
    }
    default:
      return null;
  }
}

// ─── Working Cobalt Instances ──────────────────────────────────────────────
const COBALT_INSTANCES = [
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
  const videoId = extractYoutubeId(url);
  let title = 'YouTube Video';
  let author = 'YouTube';
  let thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

  // 1. Fetch metadata via YouTube oEmbed (fast ~200ms)
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(3000)
    });
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      if (oembed.title) title = oembed.title;
      if (oembed.author_name) author = oembed.author_name;
      if (oembed.thumbnail_url) thumbnail = oembed.thumbnail_url;
    }
  } catch {}

  // 2. Primary: Cobalt API (fast, reliable)
  const cobalt = await fetchViaCobalt(url, 'auto');
  if (cobalt) {
    let audioUrl = '';
    let audioFormats = [];
    try {
      const audioCobalt = await fetchViaCobalt(url, 'audio');
      if (audioCobalt?.url) {
        audioUrl = audioCobalt.url;
        audioFormats = [
          { label: 'Audio (MP3)', url: audioCobalt.url, ext: 'mp3', abr: 128 }
        ];
      }
    } catch {}

    return {
      title,
      author,
      thumbnail,
      duration: 0,
      videoUrl: cobalt.url,
      audioUrl,
      audioExt: 'mp3',
      audioFormats,
      videoFormats: [
        { quality: 'Best / HD', height: 1080, url: cobalt.url, ext: 'mp4', hasAudio: true, filesize: null }
      ]
    };
  }

  // 3. Fallback: BTCH / backend1 API (short 4s timeout)
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status && (data.mp4 || data.mp3)) {
        const videoFormats = [];
        if (data.mp4) {
          videoFormats.push({ quality: 'HD / 720p', height: 720, url: data.mp4, ext: 'mp4', hasAudio: true, filesize: null });
        }
        const audioFormats = [];
        if (data.mp3) {
          audioFormats.push({ label: 'Audio MP3', url: data.mp3, ext: 'mp3', abr: 128, filesize: null });
        }
        return {
          title: data.title || title,
          author: data.author || author,
          thumbnail: data.thumbnail || thumbnail,
          duration: 0,
          videoUrl: data.mp4 || '',
          audioUrl: data.mp3 || '',
          audioExt: 'mp3',
          videoFormats,
          audioFormats
        };
      }
    }
  } catch (err) {
    console.warn('BTCH YouTube failed:', err.message);
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
  // Method 1: FastDL API (fast, handles Reels, posts, and multi-slide carousels)
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
    console.warn('FastDL Instagram failed:', err.message);
  }

  // Method 2: Cobalt fallback (fast)
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

  // Method 3: BTCH / backend1 API (short 4s timeout)
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(4000)
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
    console.warn('BTCH Instagram failed:', err.message);
  }

  throw new Error('Gagal mengambil video Instagram. Pastikan akun tidak privat dan tautan valid.');
}

// ─── Facebook Handler ──────────────────────────────────────────────────────
export async function handleFacebook(url) {
  // Method 1: fdown scraper
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
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const text = await res.text();
      const hdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>HD/i);
      const sdMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]*)"\s[^>]*>SD/i);
      const anyMatch = text.match(/href="(https?:\/\/[^"]*fbcdn[^"]+\.mp4[^"]*)"/i);
      const videoUrl = hdMatch?.[1] || sdMatch?.[1] || anyMatch?.[1];
      if (videoUrl) {
        return { videoUrl, title: 'Facebook Video', author: 'Facebook', thumbnail: '', duration: 0 };
      }
    }
  } catch (err) {
    console.warn('fdown failed:', err.message);
  }

  // Method 2: Cobalt fallback
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

  // Method 3: BTCH / backend1 API (short 4s timeout)
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/fbdown?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      let videoUrl = data.HD || data.Normal_video;
      if (videoUrl) {
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
    console.warn('BTCH Facebook failed:', err.message);
  }

  throw new Error('Gagal mengambil video Facebook. Pastikan video bersifat publik.');
}

// ─── Twitter Handler ───────────────────────────────────────────────────────
export async function handleTwitter(url) {
  // Method 1: fxtwitter embed API (fast, high reliability)
  const tweetId = url.match(/status\/(\d+)/)?.[1];
  if (tweetId) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.tweet?.media?.videos?.length) {
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
    } catch (err) {
      console.warn('fxtwitter failed:', err.message);
    }
  }

  // Method 2: Cobalt fallback
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

  // Method 3: BTCH / backend1 API (short 4s timeout)
  try {
    const res = await fetch(`https://backend1.tioo.eu.org/twitter?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
      signal: AbortSignal.timeout(4000)
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
    console.warn('BTCH Twitter failed:', err.message);
  }

  throw new Error('Gagal mengambil video Twitter/X. Pastikan postingan memiliki video dan tidak dikunci.');
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
    // Both failed — fallback to Cobalt video then audio
    try {
      const cobalt = await fetchViaCobalt(resolvedUrl, 'auto');
      if (cobalt) {
        return {
          tiktok: true,
          title: 'TikTok Video',
          author: { nickname: 'TikTok User' },
          cover: '',
          video: cobalt.url,
          video_watermark: '',
          audio: '',
          duration: '',
          images: []
        };
      }
    } catch { /* skip */ }

    try {
      const cobaltAudio = await fetchViaCobalt(resolvedUrl, 'audio');
      if (cobaltAudio) {
        return {
          tiktok: true,
          title: 'TikTok Video',
          author: { nickname: 'TikTok User' },
          cover: '',
          video: '',
          video_watermark: '',
          audio: cobaltAudio.url,
          duration: '',
          images: []
        };
      }
    } catch { /* skip */ }

    throw new Error('Gagal mengambil video TikTok. Coba tautan lain.');
  }
}
