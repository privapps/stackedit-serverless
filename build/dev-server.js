const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const webpack = require('webpack');
const config = require('../config');

const compiler = webpack(require('./webpack.dev.conf'));
const outputRoot = path.resolve(config.build.assetsRoot);
const staticRoot = path.resolve(__dirname, '../static');
const staticPrefix = `/${config.dev.assetsSubDirectory}/`;
const liveReloadPath = '/__webpack_live_reload';
const reloadClients = new Set();
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url || '/', 'http://localhost').pathname;
  if (requestPath === liveReloadPath) {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
    });
    response.write(': connected\n\n');
    reloadClients.add(response);
    request.on('close', () => reloadClients.delete(response));
    return;
  }

  const fromStatic = requestPath.startsWith(staticPrefix);
  let filePath = path.resolve(outputRoot, requestPath.slice(1));

  if (path.relative(outputRoot, filePath).startsWith('..')) {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  // Webpack emits fonts and images under /static too. Prefer those generated
  // assets before falling back to the repository's static files.
  if (fromStatic && (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())) {
    filePath = path.resolve(staticRoot, requestPath.slice(staticPrefix.length));
    if (path.relative(staticRoot, filePath).startsWith('..')) {
      response.writeHead(400);
      response.end('Bad request');
      return;
    }
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (fromStatic || path.extname(requestPath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    filePath = config.build.index;
  }

  if (filePath === config.build.index) {
    fs.readFile(filePath, 'utf8', (error, html) => {
      if (error) {
        console.error(error);
        response.writeHead(500);
        response.end('Unable to read the application shell');
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes['.html'],
      });
      response.end(html.replace(
        '</body>',
        `<script>new EventSource("${liveReloadPath}").onmessage = () => window.location.reload();</script></body>`,
      ));
    });
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(response);
});

const watcher = compiler.watch({}, (error, stats) => {
  if (error) {
    console.error(error);
  } else if (stats.hasErrors()) {
    console.error(stats.toString({ colors: true, all: false, errors: true, warnings: true }));
  } else {
    console.log(stats.toString({ colors: true, all: false, errors: true, warnings: true }));
    if (!server.listening) {
      server.listen(config.dev.port, 'localhost', () => {
        console.log(`Development server listening at http://localhost:${config.dev.port}`);
      });
    } else {
      for (const client of reloadClients) {
        client.write('data: reload\n\n');
      }
    }
  }
});

const shutdown = () => {
  for (const client of reloadClients) {
    client.end();
  }
  reloadClients.clear();
  watcher.close(() => {
    if (server.listening) {
      server.close();
    }
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
