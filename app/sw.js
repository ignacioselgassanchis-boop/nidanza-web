/* Service worker de la app de permisos.
   Estrategia: precache de todo y SOLO CACHÉ para lo propio. La app se sirve entera desde
   el paquete, así que no hay nada que revalidar: si está en caché se sirve, y punto.
   Lo ÚNICO que sale a la red es la autenticación (Supabase), y eso es otro origen: esas
   peticiones ni se tocan.
   Para publicar una versión nueva basta con subir VERSION: se descarga todo otra vez
   y se borran las cachés viejas. */
const VERSION = 'allonest-v53';

const RECURSOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icono.svg',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'icons/icono-180.png',
  'icons/icono-maskable-192.png',
  'icons/icono-maskable-512.png',
  'fonts/OFL.txt',
  'fonts/nunito-latin-400_900.woff2',
  'fonts/nunito-latin-ext-400_900.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(RECURSOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Otro origen = Supabase. Sin este descarte, el "solo caché" devolvería 504 al GET de
  // /auth/v1/user y no se podría entrar. Se deja pasar a la red tal cual.
  let ajeno = true;
  try { ajeno = new URL(e.request.url).origin !== self.location.origin; } catch (err) {}
  if (ajeno) return;
  e.respondWith(responde(e.request));
});

/* Nunca devolver nada que no sea una Response: Safari convierte un undefined en
   "FetchEvent.respondWith received an error: Returned response is null" y la app no abre.
   Y en iPhone la caché desaparece sola (Safari la vacía tras unos días sin uso o por falta
   de espacio) mientras el service worker sigue registrado: si no hay copia, se va a la red
   y se repone la copia para la próxima. */
async function responde(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const navega = req.mode === 'navigate';
  if (navega) {
    // Navegaciones a cualquier ruta: siempre el mismo documento.
    const doc = await cache.match('index.html');
    if (doc) return doc;
  }
  try {
    const res = await fetch(navega ? 'index.html' : req, { cache: 'no-cache' });
    if (res && res.ok) { try { await cache.put(navega ? 'index.html' : req, res.clone()); } catch (err) {} }
    return res;
  } catch (err) {
    return new Response(
      navega
        ? '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>Allonest</title><body style="font-family:system-ui;padding:40px 24px;color:#12314F;background:#FFF3E3">' +
          '<h1 style="font-size:22px">Sin conexión</h1><p>No hay copia de la app en este dispositivo y ahora mismo no hay red. ' +
          'Conéctate y vuelve a abrir <a href="./">allonest.es/app</a>.</p></body></html>'
        : '',
      { status: 503, statusText: 'Sin conexión y sin copia en caché',
        headers: navega ? { 'Content-Type': 'text/html; charset=utf-8' } : {} });
  }
}
