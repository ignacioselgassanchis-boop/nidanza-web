/* Service worker de la app de permisos.
   Estrategia: precache de todo y SOLO CACHÉ para lo propio. La app se sirve entera desde
   el paquete, así que no hay nada que revalidar: si está en caché se sirve, y punto.
   Lo ÚNICO que sale a la red es la autenticación (Supabase), y eso es otro origen: esas
   peticiones ni se tocan.
   Para publicar una versión nueva basta con subir VERSION: se descarga todo otra vez
   y se borran las cachés viejas. */
const VERSION = 'allonest-v49';

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
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      // Navegaciones a cualquier ruta: siempre el mismo documento.
      if (e.request.mode === 'navigate') return caches.match('index.html');
      // Solo caché: si algo no se precacheó, no salimos a la red a buscarlo.
      return new Response('', { status: 504, statusText: 'Sin conexión y sin copia en caché' });
    })
  );
});
