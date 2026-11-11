/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

precacheAndRoute(self.__WB_MANIFEST);
// NOTE: every navigation (including /?shared=1) is served from the precached shell, so offline reloads work.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Update prompt: the page asks the waiting worker to take over.
self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting(); });

// Share target: keep the posted file in Cache Storage and hand it to the page.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith((async () => {
    try {
      const file = (await event.request.formData()).get('file');
      if (file instanceof File) {
        const cache = await caches.open('pubcount-shared');
        await cache.put('/shared-file', new Response(await file.text()));
      }
    } catch { /* NOTE: an unreadable share just opens the app without a file. */ }
    return Response.redirect('/?shared=1', 303);
  })());
});
