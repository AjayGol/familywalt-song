for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy");

    try {
      await navigator.clipboard.writeText(text);
      window.adminPopup?.flash({
        type: "success",
        eyebrow: "Copied",
        title: "API URL copied",
        message: "The production API URL is now in your clipboard.",
      });
    } catch {
      window.adminPopup?.error("Unable to copy the API URL.", "Copy Failed");
    }
  });
}
