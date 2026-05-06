(function setupSongAdminMediaCache() {
  const serviceWorkerPath = "/song-media-cache-sw.js";

  async function evict(urls) {
    const cleanUrls = [...new Set((urls || []).filter(Boolean))];

    if (!cleanUrls.length || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const message = {
      type: "SONG_ADMIN_MEDIA_CACHE_EVICT",
      urls: cleanUrls,
    };

    navigator.serviceWorker.controller?.postMessage(message);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      registration?.active?.postMessage(message);
    } catch {}
  }

  async function register() {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      await navigator.serviceWorker.register(serviceWorkerPath, { scope: "/" });
    } catch {}
  }

  if (typeof window !== "undefined") {
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }

  window.songAdminMediaCache = {
    evict,
  };
})();
