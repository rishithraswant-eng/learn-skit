import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function handleRequest(urlStr, method = 'GET') {
  const parsedUrl = new URL(urlStr, 'http://localhost');
  let pathname = decodeURIComponent(parsedUrl.pathname);

  let statusCode = 200;
  let headers = {};
  let body = '';

  const res = {
    writeHead(code, h) {
      statusCode = code;
      headers = { ...headers, ...h };
      return res;
    },
    end(data) {
      body = data ? data.toString() : '';
      return res;
    }
  };

  try {
    if (pathname === '/opengraph-image') {
      pathname = '/opengraph-image.png';
    }

    if (/^\/(?:s|tools|admin|dashboard)(?:\/|$)/.test(pathname)) {
      res.writeHead(302, {
        'Location': `/#/?next=${encodeURIComponent(pathname + parsedUrl.search + parsedUrl.hash)}`,
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store'
      }).end();
      return { statusCode, headers, body };
    }

    if (pathname.includes('/.') || pathname.includes('\\.')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
      return { statusCode, headers, body };
    }

    let targetFile = pathname === '/' ? '/index.html' : pathname;
    let file = path.resolve(root, '.' + targetFile);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
      return { statusCode, headers, body };
    }

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

    const fileBuffer = await readFile(file);
    const responseHeaders = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname === '/robots.txt' || pathname === '/sitemap.xml' ? 'public, max-age=86400' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    if (
      pathname === '/' ||
      pathname === '/index.html' ||
      pathname === '/privacy' ||
      pathname === '/terms' ||
      pathname === '/privacy.html' ||
      pathname === '/terms.html'
    ) {
      responseHeaders['X-Robots-Tag'] = 'index, follow';
    }

    res.writeHead(200, responseHeaders).end(fileBuffer);
    return { statusCode, headers, body: fileBuffer.toString() };
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return { statusCode: 404, headers, body: 'Not found' };
  }
}
