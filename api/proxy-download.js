// Vercel Serverless Function: /api/proxy-download
// Streams a remote media URL through Vercel so the browser triggers a save dialog.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ status: false, message: 'Method not allowed' });

  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ status: false, message: 'url is required' });

  try {
    const decodedUrl = decodeURIComponent(url);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
    };

    if (req.headers['range']) {
      headers['Range'] = req.headers['range'];
    }

    const u = decodedUrl.toLowerCase();
    if (u.includes('googlevideo.com') || u.includes('youtube.com')) {
      headers['Referer'] = 'https://www.youtube.com/';
      headers['Origin'] = 'https://www.youtube.com';
    } else if (u.includes('tiktokcdn.com') || u.includes('tiktok.com') || u.includes('muscdn.com')) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
    } else if (u.includes('cdninstagram.com') || u.includes('instagram.com') || u.includes('fbcdn.net')) {
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
    } else if (u.includes('facebook.com') || u.includes('fbwat.ch')) {
      headers['Referer'] = 'https://www.facebook.com/';
    } else if (u.includes('twitter.com') || u.includes('twimg.com') || u.includes('x.com')) {
      headers['Referer'] = 'https://x.com/';
    } else {
      try {
        const parsedUrl = new URL(decodedUrl);
        headers['Referer'] = parsedUrl.origin + '/';
      } catch {
        headers['Referer'] = 'https://www.google.com/';
      }
    }

    const upstream = await fetch(decodedUrl, {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: false,
        message: `Upstream returned ${upstream.status}: ${upstream.statusText}`
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    let safeFilename = filename ? decodeURIComponent(filename) : 'download';
    safeFilename = safeFilename.split('?')[0];

    const extMap = {
      'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/opus': 'opus',
      'audio/webm': 'webm', 'video/mp4': 'mp4', 'video/webm': 'webm',
      'video/x-matroska': 'mkv',
    };
    const detectedExt = Object.entries(extMap).find(([mime]) => contentType.startsWith(mime))?.[1];
    if (!safeFilename.includes('.')) {
      safeFilename += '.' + (detectedExt || 'mp4');
    }

    res.setHeader('Content-Type', contentType);

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
      const asciiName = safeFilename.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_').replace(/"/g, '');
      const encodedName = encodeURIComponent(safeFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control', 'no-cache');
    }

    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream response body
    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };

    req.on('close', () => reader.cancel());
    await pump();
  } catch (error) {
    console.error('Proxy download error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ status: false, message: 'Proxy download failed: ' + error.message });
    }
  }
}
