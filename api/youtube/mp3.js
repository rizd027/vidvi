// Vercel Serverless Function: /api/youtube/mp3
import { fetchViaCobalt } from '../_lib/helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, title } = req.query;
  if (!url) return res.status(400).json({ status: false, message: 'url is required' });

  const decodedUrl = decodeURIComponent(url);
  const safeTitle = (title ? decodeURIComponent(title) : 'youtube-audio')
    .replace(/[^\w\s.-]/g, '_').replace(/\s+/g, '_').slice(0, 120);

  try {
    // Attempt remote audio extraction via Cobalt if available
    const cobalt = await fetchViaCobalt(decodedUrl, 'audio');
    if (cobalt?.url) {
      const audioRes = await fetch(cobalt.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (audioRes.ok) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp3"`);
        const arrayBuffer = await audioRes.arrayBuffer();
        return res.status(200).send(Buffer.from(arrayBuffer));
      }
    }
  } catch (err) {
    console.warn('Cobalt audio fallback error:', err.message);
  }

  // If serverless cannot transcode via local ffmpeg
  return res.status(422).json({
    status: false,
    message: 'Konversi MP3 membutuhkan FFmpeg di server lokal. Silakan gunakan format audio langsung atau jalankan Vidvi secara lokal.'
  });
}
