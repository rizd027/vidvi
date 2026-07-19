// Vercel Serverless Function: /api/settings
// Stateless — settings are stored in browser localStorage on the client side.
// This endpoint returns empty data so the frontend doesn't error.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ status: true, data: {} });
  }

  if (req.method === 'POST') {
    return res.status(200).json({ status: true, message: 'Settings saved' });
  }

  return res.status(405).json({ status: false, message: 'Method not allowed' });
}
