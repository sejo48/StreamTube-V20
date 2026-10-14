/* Network-only: catalogs, payments and streaming always use their normal requests. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
    event.respondWith(fetch(event.request).catch(() => new Response(`<!DOCTYPE html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Box Play TV — Sin conexión</title><body style="background:#020617;color:#f8fafc;font-family:system-ui;padding:40px 24px;text-align:center">
<h1>Box Play TV</h1><p>Necesitas conexión a Internet para cargar el catálogo y reproducir contenido.</p>
<button onclick="location.reload()" style="padding:14px 24px;border:0;border-radius:12px;background:#06b6d4;color:#020617;font-weight:bold">Reintentar</button>
</body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
