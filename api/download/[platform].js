// Vercel Serverless Function: /api/download/:platform
import {
  messages,
  validateUrl,
  resolveUrl,
  handleYoutube,
  handleInstagram,
  handleFacebook,
  handleTwitter,
  handleTikTok,
} from '../_lib/helpers.js';

const SUPPORTED_PLATFORMS = ['capcut', 'spotify', 'tiktok', 'youtube', 'instagram', 'facebook', 'twitter'];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  // Extract platform from URL path: /api/download/[platform]
  const platform = req.query.platform;
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

    // ── Spotify ──
    if (platform === 'spotify') {
      const response = await fetch(`https://bintangapi.my.id/api/downloader/spotify?url=${encodeURIComponent(resolvedUrl)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
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
    }

    // ── CapCut ──
    else if (platform === 'capcut') {
      const response = await fetch(`https://bintangapi.my.id/api/downloader/capcut?url=${encodeURIComponent(resolvedUrl)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await response.json();
      if (!data.success && !data.data) throw new Error(data.error || t.fetchFailed);
      const bData = data.data;
      result = {
        title: bData.title || 'CapCut Template',
        cover: bData.download_cover || '',
        video: bData.download_video || '',
        size: bData.size || ''
      };
    }

    // ── TikTok ──
    else if (platform === 'tiktok') {
      result = await handleTikTok(url, resolvedUrl, lang);
    }

    // ── YouTube ──
    else if (platform === 'youtube') {
      result = await handleYoutube(resolvedUrl);
    }

    // ── Instagram ──
    else if (platform === 'instagram') {
      result = await handleInstagram(resolvedUrl);
    }

    // ── Facebook ──
    else if (platform === 'facebook') {
      result = await handleFacebook(resolvedUrl);
    }

    // ── Twitter ──
    else if (platform === 'twitter') {
      result = await handleTwitter(resolvedUrl);
    }

    return res.status(200).json({ status: true, result });
  } catch (error) {
    console.error(`Error processing ${platform}:`, error.message);
    return res.status(200).json({ status: false, message: error.message });
  }
}
