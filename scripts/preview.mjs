import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // Dynamic robots.txt
    if (pathname === '/robots.txt') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400'
      }).end("User-agent: *\nAllow: /$\nAllow: /privacy\nAllow: /terms\nDisallow: /s/\nDisallow: /tools/\nDisallow: /admin/\n");
      return;
    }

    // Direct access to protected application paths redirects unauthenticated users to landing with ?next=
    if (/^\/(?:s|tools|admin)(?:\/|$)/.test(pathname)) {
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

    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403, {'Content-Type': 'text/plain'}).end('Forbidden');
      return;
    }

    const body = await readFile(file);
    const headers = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // Edge/server robots header: public landing/privacy/terms are indexed; everything else is noindex
    if (pathname === '/' || pathname === '/index.html' || pathname === '/privacy' || pathname === '/terms') {
      headers['X-Robots-Tag'] = 'index, follow';
    } else {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
    }

    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
