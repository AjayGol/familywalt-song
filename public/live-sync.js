(function setupSongAdminSync() {
  const channelName = "song-admin-live-sync";
  const listeners = new Set();
  const sourceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

  function notify(message) {
    for (const listener of listeners) {
      try {
        listener(message);
      } catch {}
    }
  }

  function normalizeEvent(message) {
    if (!message || typeof message !== "object") {
      return null;
    }

    return {
      type: message.type || "songs:changed",
      reason: message.reason || "refresh",
      songId: message.songId || null,
      categories: Array.isArray(message.categories) ? message.categories.filter(Boolean) : [],
      evictUrls: Array.isArray(message.evictUrls) ? message.evictUrls.filter(Boolean) : [],
      updatedAt: message.updatedAt || Date.now(),
      sourceId: message.sourceId || sourceId,
    };
  }

  function publish(rawMessage) {
    const message = normalizeEvent({
      ...rawMessage,
      sourceId,
      updatedAt: Date.now(),
    });

    if (!message) {
      return;
    }

    if (message.evictUrls.length) {
      window.songAdminMediaCache?.evict(message.evictUrls);
    }

    channel?.postMessage(message);

    try {
      localStorage.setItem(channelName, JSON.stringify(message));
      localStorage.removeItem(channelName);
    } catch {}
  }

  function handleIncoming(rawMessage) {
    const message = normalizeEvent(rawMessage);

    if (!message || message.sourceId === sourceId) {
      return;
    }

    if (message.evictUrls.length) {
      window.songAdminMediaCache?.evict(message.evictUrls);
    }

    notify(message);
  }

  channel?.addEventListener("message", (event) => {
    handleIncoming(event.data);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== channelName || !event.newValue) {
      return;
    }

    try {
      handleIncoming(JSON.parse(event.newValue));
    } catch {}
  });

  window.songAdminSync = {
    publish,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
