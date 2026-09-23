import handler from './[platform].js';

export default async function (req, res) {
  req.query = req.query || {};
  req.query.platform = 'facebook';
  return handler(req, res);
}
