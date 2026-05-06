const DEFAULT_TTL_MS = 30 * 1000;

const store = new Map();

function getCacheKey(namespace, payload) {
  return `${namespace}:${JSON.stringify(payload || {})}`;
}

function readEntry(key) {
  const entry = store.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

function writeEntry(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

async function remember(namespace, payload, loader, options = {}) {
  const key = getCacheKey(namespace, payload);
  const cachedValue = readEntry(key);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const nextValue = await loader();
  return writeEntry(key, nextValue, options.ttlMs);
}

function invalidateSongQueryCache() {
  store.clear();
}

module.exports = {
  invalidateSongQueryCache,
  remember,
};
