// Vercel Serverless Function: /api/history/:id (DELETE)
// Stateless — no-op since history is stored in browser localStorage.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'DELETE') {
    const { id } = req.query;
    return res.status(200).json({ status: true, message: `Record ${id} deleted` });
  }

  return res.status(405).json({ status: false, message: 'Method not allowed' });
}
