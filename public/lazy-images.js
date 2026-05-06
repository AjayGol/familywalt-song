(function setupSongAdminLazyImages() {
  const transparentPixel =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const initialized = new WeakSet();
  let observer = null;

  function loadImage(image) {
    if (!image || initialized.has(image)) {
      return;
    }

    initialized.add(image);
    const src = image.getAttribute("data-src");

    if (!src) {
      return;
    }

    image.src = src;
    image.removeAttribute("data-src");
    image.removeAttribute("data-lazy-image");
  }

  function ensureObserver() {
    if (observer || !("IntersectionObserver" in window)) {
      return observer;
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          observer.unobserve(entry.target);
          loadImage(entry.target);
        }
      },
      {
        rootMargin: "320px",
      },
    );

    return observer;
  }

  function upgrade(root = document) {
    const images = root.querySelectorAll("img[data-lazy-image]");

    for (const image of images) {
      const src = image.getAttribute("data-src");

      if (!src || initialized.has(image)) {
        continue;
      }

      image.decoding = "async";
      image.loading = "lazy";

      if (!image.getAttribute("src")) {
        image.src = transparentPixel;
      }

      if (!("IntersectionObserver" in window)) {
        loadImage(image);
        continue;
      }

      ensureObserver()?.observe(image);
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => upgrade(), { once: true });
    } else {
      upgrade();
    }
  }

  window.songAdminLazyImages = {
    upgrade,
  };
})();
