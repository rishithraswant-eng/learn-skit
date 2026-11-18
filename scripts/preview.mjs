import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = {
  '.woff2': 'font/woff2',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json'
};

http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Support rewrite of /opengraph-image to /opengraph-image.png
    if (pathname === '/opengraph-image') {
      pathname = '/opengraph-image.png';
    }

    // Direct access to protected application paths redirects unauthenticated users to landing with ?next=
    if (/^\/(?:s|tools|admin|dashboard)(?:\/|$)/.test(pathname)) {
      res.writeHead(302, {
        'Location': `/#/?next=${encodeURIComponent(pathname + parsedUrl.search + parsedUrl.hash)}`,
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store'
      }).end();
      return;
    }

    // Prevent directory traversal or access to hidden/system files
    if (pathname.includes('/.') || pathname.includes('\\.')) {
      res.writeHead(403, {'Content-Type': 'text/plain'}).end('Forbidden');
      return;
    }

    let targetFile = pathname === '/' ? '/index.html' : pathname;
    let file = path.resolve(root, '.' + targetFile);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403, {'Content-Type': 'text/plain'}).end('Forbidden');
      return;
    }

    // Clean URLs: check if .html file exists
    try {
      const s = await stat(file);
      if (s.isDirectory()) {
        file = path.join(file, 'index.html');
      }
    } catch {
      if (!path.extname(file)) {
        const withHtml = file + '.html';
        try {
          await stat(withHtml);
          file = withHtml;
        } catch {}
      }
    }

    const body = await readFile(file);
    const headers = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname === '/robots.txt' || pathname === '/sitemap.xml' ? 'public, max-age=86400' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Public pages: landing, privacy, terms, robots, sitemap, manifest, icons
    if (
      pathname === '/' ||
      pathname === '/index.html' ||
      pathname === '/privacy' ||
      pathname === '/terms' ||
      pathname === '/privacy.html' ||
      pathname === '/terms.html'
    ) {
      headers['X-Robots-Tag'] = 'index, follow';
    }

    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
