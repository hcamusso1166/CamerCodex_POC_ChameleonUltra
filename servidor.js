import http from 'node:http'
import https from 'node:https'
import { readFile } from 'node:fs/promises'

const sdk = './node_modules/chameleon-ultra.js/dist/'
const archivos = new Map([
  ['/', './web/index.html'], ['/estilo.css', './web/estilo.css'],
  ['/app.js', './web/app.js'], ['/lector.js', './web/lector.js'],
  ['/diagnostico.js', './web/diagnostico.js'],
  ['/sdk.js', sdk + 'index.global.js'], ['/ble.js', sdk + 'plugin/WebbleAdapter.global.js']
])
async function servir(req, res) {
  const archivo = archivos.get(req.url)
  if (req.method !== 'GET' || !archivo) return res.writeHead(404).end()
  try {
    const datos = await readFile(new URL(archivo, import.meta.url))
    const tipo = archivo.endsWith('.html') ? 'text/html' : archivo.endsWith('.css') ? 'text/css' : 'text/javascript'
    res.writeHead(200, { 'Content-Type': tipo + '; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }).end(datos)
  } catch {
    res.writeHead(500).end('Revisá la instalación local.')
  }
}

const { A1_CERT, A1_KEY } = process.env
if (Boolean(A1_CERT) !== Boolean(A1_KEY)) throw new Error('Configurá A1_CERT y A1_KEY juntos.')
const server = A1_CERT ? https.createServer({ cert: await readFile(A1_CERT), key: await readFile(A1_KEY) }, servir)
  : http.createServer(servir)
server.listen(8443, '127.0.0.1', () => console.log((A1_CERT ? 'https' : 'http') + '://127.0.0.1:8443'))
