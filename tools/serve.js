// serve.js — servidor estático mínimo para desarrollo.
// Hace falta porque `import` de módulos ES no funciona sobre file:// (CORS).
//   node tools/serve.js [puerto]

const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = Number(process.argv[2]) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const destino = path.join(RAIZ, rel);

  // Nada fuera de la raíz del proyecto.
  if (!destino.startsWith(RAIZ)) { res.writeHead(403); res.end('403'); return; }
  if (!fs.existsSync(destino) || fs.statSync(destino).isDirectory()) { res.writeHead(404); res.end('404'); return; }

  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(fs.readFileSync(destino));
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`Snake Roguelite en http://127.0.0.1:${PUERTO}/`);
});
