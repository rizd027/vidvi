import handler from './_downloadHandler.js';

export default async function (req, res) {
  req.query = req.query || {};
  req.query.platform = 'spotify';
  return handler(req, res);
}
