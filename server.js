#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Production entry point for Hostinger's Node.js app hosting.

   This is a static-file server only — the application itself has no backend
   (see DEPLOYMENT.md). It serves the contents of build/ and falls back to
   index.html for any path that isn't a real file, so client-side routes like
   /twin and /projects/RVNL-001 work on direct load and on refresh, the same
   guarantee .htaccess provides on Apache hosting.

   Hostinger's Node.js panel runs this file directly (Application startup
   file: server.js, Application root: repo root) and provides the port to
   listen on via the PORT environment variable.
   ═══════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=UTF-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=UTF-8',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  /* Asset filenames are content-hashed; index.html is served no-cache so
     returning visitors pick up a new deploy without a manual refresh. */
  const cacheControl = path.basename(filePath) === 'index.html'
    ? 'no-cache'
    : 'public, max-age=31536000, immutable';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(BUILD_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.access(filePath, fs.constants.F_OK, (accessErr) => {
      sendFile(res, accessErr ? path.join(BUILD_DIR, 'index.html') : filePath);
    });
  });
});

server.listen(PORT, () => {
  console.log(`rvnl-nirman-setu listening on port ${PORT}`);
});
