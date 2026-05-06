(function () {
  if (window.adminPopup) {
    return;
  }

  const root = document.createElement("div");
  root.className = "popup-root";
  root.innerHTML = `
    <div class="popup-backdrop is-hidden" data-popup-backdrop>
      <div class="popup-modal" role="dialog" aria-modal="true" aria-live="polite" aria-busy="false">
        <div class="popup-modal__status">
          <div class="popup-modal__icon" data-popup-icon></div>
          <div class="popup-spinner is-hidden" data-popup-spinner></div>
        </div>
        <div class="popup-modal__content">
          <p class="popup-modal__eyebrow" data-popup-eyebrow></p>
          <h2 class="popup-modal__title" data-popup-title></h2>
          <p class="popup-modal__message" data-popup-message></p>
        </div>
        <div class="popup-progress is-hidden" data-popup-progress-wrap>
          <div class="popup-progress__bar" data-popup-progress-bar></div>
        </div>
        <div class="popup-progress__label is-hidden" data-popup-progress-label></div>
        <div class="popup-modal__actions" data-popup-actions></div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const backdrop = root.querySelector("[data-popup-backdrop]");
  const modal = root.querySelector(".popup-modal");
  const icon = root.querySelector("[data-popup-icon]");
  const spinner = root.querySelector("[data-popup-spinner]");
  const eyebrow = root.querySelector("[data-popup-eyebrow]");
  const title = root.querySelector("[data-popup-title]");
  const message = root.querySelector("[data-popup-message]");
  const actions = root.querySelector("[data-popup-actions]");
  const progressWrap = root.querySelector("[data-popup-progress-wrap]");
  const progressBar = root.querySelector("[data-popup-progress-bar]");
  const progressLabel = root.querySelector("[data-popup-progress-label]");

  let activeResolver = null;

  function toggleBodyLock(locked) {
    document.documentElement.classList.toggle("popup-page-lock", locked);
    document.body.classList.toggle("popup-page-lock", locked);
  }

  function resetActions() {
    actions.innerHTML = "";
  }

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    if (className) {
      button.className = className;
    }
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function setProgress(value, text) {
    if (typeof value === "number") {
      progressWrap.classList.remove("is-hidden");
      progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
      progressLabel.classList.remove("is-hidden");
      progressLabel.textContent = text || `${Math.round(value)}%`;
      return;
    }

    progressWrap.classList.add("is-hidden");
    progressLabel.classList.add("is-hidden");
    progressBar.style.width = "0%";
    progressLabel.textContent = "";
  }

  function setVisible(visible) {
    backdrop.classList.toggle("is-hidden", !visible);
    toggleBodyLock(visible);
  }

  function closeModal(result) {
    setVisible(false);
    modal.dataset.variant = "";
    modal.setAttribute("aria-busy", "false");
    spinner.classList.add("is-hidden");
    icon.classList.remove("is-hidden");
    resetActions();
    setProgress(null);
    if (activeResolver) {
      const resolve = activeResolver;
      activeResolver = null;
      resolve(result);
    }
  }

  function openModal(options) {
    modal.dataset.variant = options.variant || "info";
    icon.textContent = options.icon || "i";
    eyebrow.textContent = options.eyebrow || "";
    title.textContent = options.title || "Message";
    message.textContent = options.message || "";
    modal.setAttribute("aria-busy", options.loading ? "true" : "false");
    spinner.classList.toggle("is-hidden", !options.loading);
    icon.classList.toggle("is-hidden", !!options.loading);
    resetActions();
    setProgress(options.progress, options.progressText);
    setVisible(true);
  }

  function alert(options) {
    return new Promise((resolve) => {
      activeResolver = resolve;
      openModal({
        variant: options.type || "info",
        icon: options.icon || (options.type === "success" ? "✓" : options.type === "error" ? "!" : "i"),
        eyebrow: options.eyebrow || "Notification",
        title: options.title || "Message",
        message: options.message || "",
      });

      actions.appendChild(
        createButton(options.buttonText || "Okay", options.buttonClassName || "", () => {
          closeModal(true);
        }),
      );
    });
  }

  function confirm(options) {
    return new Promise((resolve) => {
      activeResolver = resolve;
      openModal({
        variant: options.danger ? "danger" : "confirm",
        icon: options.icon || (options.danger ? "!" : "?"),
        eyebrow: options.eyebrow || "Confirmation",
        title: options.title || "Confirm",
        message: options.message || "",
      });

      actions.appendChild(
        createButton(options.cancelText || "Cancel", "secondary", () => {
          closeModal(false);
        }),
      );
      actions.appendChild(
        createButton(options.confirmText || "Confirm", options.danger ? "danger-button" : "", () => {
          closeModal(true);
        }),
      );
    });
  }

  function showLoading(options) {
    openModal({
      variant: "loading",
      eyebrow: options.eyebrow || "Processing",
      title: options.title || "Please wait",
      message: options.message || "",
      loading: true,
      progress: typeof options.progress === "number" ? options.progress : null,
      progressText: options.progressText || "",
    });

    return {
      setMessage(nextMessage) {
        message.textContent = nextMessage || "";
      },
      setTitle(nextTitle) {
        title.textContent = nextTitle || "Please wait";
      },
      setProgress(value, text) {
        setProgress(value, text);
      },
      close() {
        closeModal(true);
      },
    };
  }

  function flash(options) {
    return new Promise((resolve) => {
      activeResolver = resolve;
      openModal({
        variant: options.type || "info",
        icon: options.icon || (options.type === "success" ? "✓" : options.type === "error" ? "!" : "i"),
        eyebrow: options.eyebrow || "Notice",
        title: options.title || "Message",
        message: options.message || "",
      });

      window.setTimeout(() => {
        closeModal(true);
      }, options.duration || 1400);
    });
  }

  window.adminPopup = {
    alert,
    confirm,
    flash,
    showLoading,
    success(messageText, titleText = "Success") {
      return alert({
        type: "success",
        eyebrow: "Completed",
        title: titleText,
        message: messageText,
      });
    },
    error(messageText, titleText = "Error") {
      return alert({
        type: "error",
        eyebrow: "Attention",
        title: titleText,
        message: messageText,
      });
    },
    info(messageText, titleText = "Info") {
      return alert({
        type: "info",
        eyebrow: "Information",
        title: titleText,
        message: messageText,
      });
    },
  };
})();
