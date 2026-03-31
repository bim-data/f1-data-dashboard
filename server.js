// Pitwall 2026 — local proxy server
// Proxies requests to OpenF1 API to bypass browser CORS restrictions
// Usage: node server.js
// Then open: http://localhost:3000

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const OPENF1_BASE = 'api.openf1.org';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy OpenF1 API requests
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api', '/v1') + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    const options = {
      hostname: OPENF1_BASE,
      path: apiPath,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };

    const proxy = https.request(options, (apiRes) => {
      res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
      apiRes.pipe(res);
    });

    proxy.on('error', (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });

    proxy.end();
    return;
  }

// --- FIXED STATIC FILE SERVING ---
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Ensure we are looking in the correct directory
  const filePath = path.join(__dirname, relativePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`❌ File not found: ${filePath}`);
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    // Explicitly grab the MIME type. If extension is '.js', this MUST be 'text/javascript'
    const contentType = MIME[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🏁 Pitwall 2026 running at http://localhost:${PORT}\n`);
});
