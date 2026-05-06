const categorySelect = document.getElementById("category");
const filesInput = document.getElementById("files-input");
const folderInput = document.getElementById("folder-input");
const uploadForm = document.getElementById("upload-form");
const uploadButton = document.getElementById("upload-button");
const resetButton = document.getElementById("reset-button");
const selectionSummary = document.getElementById("selection-summary");
const resultOutput = document.getElementById("result-output");
const statusBadge = document.getElementById("status-badge");

function setStatus(label, className) {
  statusBadge.textContent = label;
  statusBadge.className = `badge ${className}`;
}

function getSelectedFiles() {
  return [...(filesInput.files || []), ...(folderInput.files || [])];
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/bulk");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    });

    xhr.addEventListener("load", () => {
      let payload = null;

      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = { error: "Invalid server response." };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || "Upload failed."));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload request failed."));
    });

    xhr.send(formData);
  });
}

function updateSelectionSummary() {
  const files = getSelectedFiles();

  if (!files.length) {
    selectionSummary.textContent = "No files selected.";
    return;
  }

  const names = files.slice(0, 6).map((file) => file.webkitRelativePath || file.name);
  const extraCount = Math.max(0, files.length - names.length);
  selectionSummary.textContent =
    `${files.length} file(s) ready: ${names.join(", ")}` + (extraCount ? ` and ${extraCount} more.` : ".");
}

async function loadCategories() {
  const response = await fetch("/api/categories", { cache: "no-store" });
  const payload = await response.json();

  categorySelect.innerHTML = "";

  for (const category of payload.categories || []) {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = `${category.label} (${category.rootFolder})`;
    categorySelect.appendChild(option);
  }
}

async function uploadFiles(event) {
  event.preventDefault();

  const files = getSelectedFiles();

  if (!files.length) {
    resultOutput.textContent = "Please select at least one audio file or one folder.";
    setStatus("Error", "error");
    await window.adminPopup?.error("Select at least one audio file or one folder.");
    return;
  }

  const formData = new FormData();
  formData.append("category", categorySelect.value);

  for (const file of files) {
    formData.append("audioFiles", file, file.name);
  }

  uploadButton.disabled = true;
  setStatus("Uploading", "busy");
  resultOutput.textContent = "Uploading files...";
  const progressPopup = window.adminPopup?.showLoading({
    eyebrow: "Uploading Songs",
    title: "Bulk upload in progress",
    message: "Uploading files and preparing metadata.",
    progress: 0,
    progressText: "0%",
  });

  try {
    const payload = await uploadWithProgress(formData, (percent) => {
      progressPopup?.setProgress(percent, `${percent}% uploaded`);
      progressPopup?.setMessage(`Uploading files to the server. ${percent}% completed.`);
    });

    resultOutput.textContent = JSON.stringify(payload, null, 2);
    setStatus("Done", "success");
    progressPopup?.close();
    await window.adminPopup?.success(
      `Uploaded ${payload.uploaded}, skipped ${payload.skipped}, failed ${payload.failed}.`,
      "Upload Complete",
    );
    if (payload.uploaded > 0) {
      window.songAdminSync?.publish({
        type: "songs:changed",
        reason: "upload",
        categories: [categorySelect.value],
      });
    }
  } catch (error) {
    progressPopup?.close();
    resultOutput.textContent = error instanceof Error ? error.message : String(error);
    setStatus("Error", "error");
    await window.adminPopup?.error(error instanceof Error ? error.message : String(error), "Upload Failed");
  } finally {
    uploadButton.disabled = false;
  }
}

function resetSelection() {
  filesInput.value = "";
  folderInput.value = "";
  updateSelectionSummary();
  resultOutput.textContent = "Waiting for upload.";
  setStatus("Idle", "idle");
}

filesInput.addEventListener("change", updateSelectionSummary);
folderInput.addEventListener("change", updateSelectionSummary);
uploadForm.addEventListener("submit", uploadFiles);
resetButton.addEventListener("click", resetSelection);

loadCategories()
  .then(() => {
    updateSelectionSummary();
  })
  .catch((error) => {
    resultOutput.textContent = error instanceof Error ? error.message : String(error);
    setStatus("Error", "error");
    window.adminPopup?.error(error instanceof Error ? error.message : String(error), "Category Load Failed");
  });
