const CACHE_NAME = "song-admin-media-v1";

function isCacheableImageRequest(request) {
  if (request.method !== "GET" || request.destination !== "image") {
    return false;
  }

  const url = new URL(request.url);
  return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

async function matchCachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request, { ignoreVary: true });
}

async function updateCachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(request);

  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableImageRequest(event.request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await matchCachedResponse(event.request);

      if (cachedResponse) {
        event.waitUntil(updateCachedResponse(event.request).catch(() => undefined));
        return cachedResponse;
      }

      return updateCachedResponse(event.request);
    })(),
  );
});

self.addEventListener("message", (event) => {
  const message = event.data;

  if (!message || message.type !== "SONG_ADMIN_MEDIA_CACHE_EVICT" || !Array.isArray(message.urls)) {
    return;
  }

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        message.urls
          .filter(Boolean)
          .map((url) => cache.delete(url))
      );
    })(),
  );
});
