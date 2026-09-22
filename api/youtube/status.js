// Vercel Serverless Function: /api/youtube/status
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // In Vercel serverless environment, local FFmpeg/yt-dlp binaries are not available.
  return res.status(200).json({
    status: true,
    hasYtdlp: false,
    hasFfmpeg: false,
    ffmpegPath: null,
    isServerless: true
  });
}
