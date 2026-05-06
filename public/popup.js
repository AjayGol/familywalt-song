(function () {
  if (window.adminPopup) {
    return;
  }

  const root = document.createElement("div");
  root.className = "popup-root";
  root.innerHTML = `
    <div class="popup-backdrop is-hidden" data-popup-backdrop>
      <div class="popup-modal" role="dialog" aria-modal="true" aria-live="polite">
        <div class="popup-modal__icon" data-popup-icon></div>
        <h2 class="popup-modal__title" data-popup-title></h2>
        <p class="popup-modal__message" data-popup-message></p>
        <div class="popup-modal__actions" data-popup-actions></div>
      </div>
    </div>
    <div class="popup-toast-stack" data-popup-toast-stack></div>
  `;

  document.body.appendChild(root);

  const backdrop = root.querySelector("[data-popup-backdrop]");
  const icon = root.querySelector("[data-popup-icon]");
  const title = root.querySelector("[data-popup-title]");
  const message = root.querySelector("[data-popup-message]");
  const actions = root.querySelector("[data-popup-actions]");
  const toastStack = root.querySelector("[data-popup-toast-stack]");

  function setModalState(visible) {
    backdrop.classList.toggle("is-hidden", !visible);
  }

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function confirm(options) {
    return new Promise((resolve) => {
      icon.textContent = options.icon || "?";
      title.textContent = options.title || "Confirm";
      message.textContent = options.message || "";
      actions.innerHTML = "";

      const cancelButton = createButton(options.cancelText || "Cancel", "secondary", () => {
        setModalState(false);
        resolve(false);
      });
      const confirmButton = createButton(options.confirmText || "Confirm", options.danger ? "danger-button" : "", () => {
        setModalState(false);
        resolve(true);
      });

      actions.appendChild(cancelButton);
      actions.appendChild(confirmButton);
      setModalState(true);
    });
  }

  function toast(type, heading, body) {
    const item = document.createElement("div");
    item.className = `popup-toast popup-toast--${type}`;
    item.innerHTML = `
      <strong>${heading}</strong>
      <span>${body}</span>
    `;

    toastStack.appendChild(item);

    window.setTimeout(() => {
      item.classList.add("is-leaving");
      window.setTimeout(() => item.remove(), 220);
    }, 2200);
  }

  function alert(options) {
    toast(options.type || "info", options.title || "Message", options.message || "");
  }

  window.adminPopup = {
    alert,
    confirm,
    success(message, titleText = "Success") {
      alert({ type: "success", title: titleText, message });
    },
    error(message, titleText = "Error") {
      alert({ type: "error", title: titleText, message });
    },
    info(message, titleText = "Info") {
      alert({ type: "info", title: titleText, message });
    },
  };
})();
