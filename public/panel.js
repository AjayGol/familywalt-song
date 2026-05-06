for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy");

    try {
      await navigator.clipboard.writeText(text);
      window.adminPopup?.success("API URL copied to clipboard.", "Copied");
    } catch {
      window.adminPopup?.error("Unable to copy the API URL.", "Copy Failed");
    }
  });
}
