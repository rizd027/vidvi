// Vercel Serverless Function: /api/history
// Stateless — history is stored in browser localStorage on the client side.
// This endpoint returns an empty array so the frontend doesn't error.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ status: true, data: [] });
  }

  if (req.method === 'DELETE') {
    return res.status(200).json({ status: true, message: 'History cleared' });
  }

  return res.status(405).json({ status: false, message: 'Method not allowed' });
}
