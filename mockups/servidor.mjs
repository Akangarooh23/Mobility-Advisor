/** Servidor estático mínimo para ver los mockups en local. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const RAIZ = new URL('.', import.meta.url).pathname.slice(1)
// Las fotos de coche viven en el public de la aplicación, no aquí: el mockup las
// pide con el prefijo /fotos/ para no duplicar ficheros pesados en esta carpeta.
const FOTOS = new URL('../public/', import.meta.url).pathname.slice(1)
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
}

createServer(async (req, res) => {
  let ruta = req.url === '/' ? '/home-v3.html' : decodeURIComponent(req.url.split('?')[0])
  if (ruta.endsWith('/')) ruta += 'index.html'   // /popgo/ → /popgo/index.html
  const destino = ruta.startsWith('/fotos/')
    ? join(FOTOS, ruta.slice('/fotos/'.length))
    : join(RAIZ, ruta)
  try {
    const datos = await readFile(destino)
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] ?? 'application/octet-stream' })
    res.end(datos)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('No está: ' + ruta)
  }
}).listen(4173, () => console.log('http://localhost:4173'))
