// Local preview without Netlify: serves public/ and routes /api/* to the function.
// SF_ACCESS_TOKEN and SF_INSTANCE_URL must be set (see README).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handler } = require('./netlify/functions/checkin');

const PORT = process.env.PORT || 8888;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    const out = await handler({
      path: url.pathname, httpMethod: req.method, body,
      queryStringParameters: Object.fromEntries(url.searchParams),
    });
    res.writeHead(out.statusCode, out.headers);
    return res.end(out.body);
  }
  const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Check-in prototype on http://localhost:${PORT}`));
