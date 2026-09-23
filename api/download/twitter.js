import handler from './[platform].js';

export default async function (req, res) {
  req.query = req.query || {};
  req.query.platform = 'twitter';
  return handler(req, res);
}
