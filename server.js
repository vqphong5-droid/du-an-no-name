const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const apiHandler = require('./api/index.js');

const PORT = 3000;

// Helper to serve static files
function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  console.log(`${req.method} ${pathname}`);

  // Route API requests to the shared serverless function handler
  if (pathname.startsWith('/api/')) {
    apiHandler(req, res);
    return;
  }

  // --- HTML / STATIC ROUTES ---
  if (pathname === '/' || pathname === '/index.html') {
    serveStaticFile(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/admin' || pathname === '/admin/') {
    serveStaticFile(res, path.join(__dirname, 'admin.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/checkout' || pathname === '/checkout/') {
    serveStaticFile(res, path.join(__dirname, 'checkout.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/script.js') {
    serveStaticFile(res, path.join(__dirname, 'script.js'), 'application/javascript; charset=utf-8');
    return;
  }
  if (pathname === '/checkout.js') {
    serveStaticFile(res, path.join(__dirname, 'checkout.js'), 'application/javascript; charset=utf-8');
    return;
  }
  if (pathname === '/style.css') {
    serveStaticFile(res, path.join(__dirname, 'style.css'), 'text/css; charset=utf-8');
    return;
  }
  if (pathname === '/waitlist.json') {
    serveStaticFile(res, path.join(__dirname, 'waitlist.json'), 'application/json; charset=utf-8');
    return;
  }
  if (pathname.startsWith('/images/')) {
    const filename = path.basename(pathname);
    const ext = path.extname(pathname).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    serveStaticFile(res, path.join(__dirname, 'images', filename), contentType);
    return;
  }
  if (pathname.startsWith('/data/')) {
    const relativePath = pathname.substring(6); // remove '/data/'
    const filePath = path.join(__dirname, 'data', relativePath);
    serveStaticFile(res, filePath, 'text/markdown; charset=utf-8');
    return;
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);

  // Periodic Email Queue Worker (simulates Vercel Cron locally)
  // Runs every 1 minute to check for due emails in the sequence
  setInterval(() => {
    fetch(`http://localhost:${PORT}/api/cron`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.processed > 0) {
          console.log(`[Local Cron Worker] Processed ${data.processed} emails: Sent ${data.sent}, Failed ${data.failed}`);
        }
      })
      .catch(err => {
        console.error("[Local Cron Worker] Error contacting cron endpoint:", err.message);
      });
  }, 60000); // 60 seconds
});
