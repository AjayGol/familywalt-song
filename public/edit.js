const editCategoryFilter = document.getElementById("edit-category-filter");
const editSongList = document.getElementById("edit-song-list");
const editEmpty = document.getElementById("edit-empty");
const editFormShell = document.getElementById("edit-form-shell");
const editStatusBadge = document.getElementById("edit-status-badge");
const editForm = document.getElementById("edit-form");
const editSongId = document.getElementById("edit-song-id");
const editTitle = document.getElementById("edit-title");
const editTitleHindi = document.getElementById("edit-title-hindi");
const editArtist = document.getElementById("edit-artist");
const editCategory = document.getElementById("edit-category");
const editCover = document.getElementById("edit-cover");
const editAudio = document.getElementById("edit-audio");
const editResult = document.getElementById("edit-result");
const editPlayerLink = document.getElementById("edit-player-link");
const saveButton = document.getElementById("save-button");
const deleteButton = document.getElementById("delete-button");

let categories = [];
let songs = [];
let selectedSong = null;
let currentFilterCategory = "";
let refreshTimer = null;

function setStatus(label, className) {
  editStatusBadge.textContent = label;
  editStatusBadge.className = `badge ${className}`;
}

function updateUrl(songId, category) {
  const url = new URL(window.location.href);

  if (songId) {
    url.searchParams.set("id", songId);
  } else {
    url.searchParams.delete("id");
  }

  if (category) {
    url.searchParams.set("category", category);
  } else {
    url.searchParams.delete("category");
  }

  window.history.replaceState({}, "", url.toString());
}

function renderError(message) {
  setStatus("Error", "error");
  editResult.textContent = message;
  window.adminPopup?.error(message, "Edit Error");
}

function renderSongList() {
  editSongList.innerHTML = "";

  if (!songs.length) {
    editSongList.innerHTML = '<div class="song-list__empty">No songs found in this category.</div>';
    return;
  }

  for (const song of songs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `song-item${selectedSong?.id === song.id ? " is-active" : ""}`;
    button.innerHTML = `
      <img src="${song.imageUrl}" alt="${song.title}" />
      <div class="song-item__content">
        <strong>${song.displayTitle || song.title}</strong>
        <span>${song.artist}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      loadSong(song.id, { showLoading: true }).catch((error) => {
        renderError(error instanceof Error ? error.message : String(error));
      });
    });
    editSongList.appendChild(button);
  }
}

function populateCategorySelect(selectElement) {
  selectElement.innerHTML = "";

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    selectElement.appendChild(option);
  }
}

async function loadCategories() {
  const response = await fetch("/api/categories", { cache: "no-store" });
  const payload = await response.json();
  categories = payload.categories || [];
  populateCategorySelect(editCategoryFilter);
  populateCategorySelect(editCategory);
  currentFilterCategory =
    new URLSearchParams(window.location.search).get("category") ||
    categories[0]?.value ||
    "";
  editCategoryFilter.value = currentFilterCategory;
}

async function loadSongs(preferredSongId = null) {
  currentFilterCategory = editCategoryFilter.value;
  updateUrl(selectedSong?.id || preferredSongId || "", currentFilterCategory);

  const response = await fetch(
    `/api/songs?category=${encodeURIComponent(editCategoryFilter.value)}&limit=200&lang=en`,
    { cache: "no-store" },
  );
  const payload = await response.json();
  songs = payload.songs || [];
  renderSongList();

  const urlSongId = preferredSongId || new URLSearchParams(window.location.search).get("id");
  const songInList = urlSongId ? songs.find((song) => song.id === urlSongId) : null;
  const nextId = songInList?.id || songs[0]?.id || null;

  if (nextId) {
    await loadSong(nextId);
  } else {
    selectedSong = null;
    editEmpty.classList.remove("is-hidden");
    editFormShell.classList.add("is-hidden");
    editResult.textContent = "No song selected.";
    setStatus("Idle", "idle");
  }
}

async function loadSong(songId, options = {}) {
  const loadingPopup = options.showLoading
    ? window.adminPopup?.showLoading({
        eyebrow: "Loading Song",
        title: "Opening song details",
        message: "Fetching song information.",
      })
    : null;

  const response = await fetch(`/api/songs/${encodeURIComponent(songId)}`, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    loadingPopup?.close();
    throw new Error(payload.error || "Unable to load song.");
  }

  selectedSong = payload.song;
  currentFilterCategory = selectedSong.category;
  if (editCategoryFilter.value !== selectedSong.category) {
    editCategoryFilter.value = selectedSong.category;
  }
  updateUrl(selectedSong.id, currentFilterCategory);
  editEmpty.classList.add("is-hidden");
  editFormShell.classList.remove("is-hidden");
  editSongId.value = selectedSong.id;
  editTitle.value = selectedSong.title;
  editTitleHindi.value = selectedSong.titleHindi || "";
  editArtist.value = selectedSong.artist;
  editCategory.value = selectedSong.category;
  editCover.src = selectedSong.imageUrl;
  editAudio.src = selectedSong.audioUrl;
  editPlayerLink.href = `/player.html?category=${encodeURIComponent(selectedSong.category)}`;
  editResult.textContent = JSON.stringify(selectedSong, null, 2);
  setStatus("Loaded", "idle");
  renderSongList();
  loadingPopup?.close();
}

async function saveSong(event) {
  event.preventDefault();

  if (!editSongId.value) {
    setStatus("Error", "error");
    editResult.textContent = "Select a song before saving.";
    return;
  }

  saveButton.disabled = true;
  setStatus("Saving", "busy");
  const loadingPopup = window.adminPopup?.showLoading({
    eyebrow: "Saving Changes",
    title: "Updating song",
    message: "Saving English name, Hindi name, artist, and category.",
  });
  const previousCategory = selectedSong?.category || editCategory.value;

  try {
    const response = await fetch(`/api/songs/${encodeURIComponent(editSongId.value)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle.value,
        titleHindi: editTitleHindi.value,
        artist: editArtist.value,
        category: editCategory.value,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to save song.");
    }

    selectedSong = payload.song;
    editResult.textContent = JSON.stringify(payload, null, 2);
    setStatus("Saved", "success");
    loadingPopup?.close();
    await window.adminPopup?.success("Song details updated successfully.", "Song Saved");
    window.songAdminSync?.publish({
      type: "songs:changed",
      reason: "edit",
      songId: selectedSong.id,
      categories: [previousCategory, selectedSong.category],
    });
    editCategoryFilter.value = selectedSong.category;
    await loadSongs(selectedSong.id);
    await loadSong(selectedSong.id);
  } catch (error) {
    loadingPopup?.close();
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteCurrentSong() {
  if (!editSongId.value) {
    renderError("Select a song before deleting.");
    return;
  }

  const confirmed = await window.adminPopup.confirm({
    title: "Delete Song",
    message: "Delete this song and its stored files?",
    confirmText: "Delete",
    cancelText: "Cancel",
    danger: true,
    icon: "!",
  });

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  setStatus("Deleting", "busy");
  const loadingPopup = window.adminPopup?.showLoading({
    eyebrow: "Deleting Song",
    title: "Removing song",
    message: "Deleting the song and linked files.",
  });

  try {
    const response = await fetch(`/api/songs/${encodeURIComponent(editSongId.value)}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to delete song.");
    }

    selectedSong = null;
    editEmpty.classList.remove("is-hidden");
    editFormShell.classList.add("is-hidden");
    editResult.textContent = JSON.stringify(payload, null, 2);
    setStatus("Deleted", "success");
    loadingPopup?.close();
    await window.adminPopup?.success("Song deleted successfully.", "Song Deleted");
    window.songAdminSync?.publish({
      type: "songs:changed",
      reason: "delete",
      songId: payload.song?.id || editSongId.value,
      categories: [payload.song?.category || currentFilterCategory],
    });
    updateUrl("", editCategoryFilter.value);
    await loadSongs();
  } catch (error) {
    loadingPopup?.close();
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    deleteButton.disabled = false;
  }
}

function scheduleExternalRefresh(message) {
  const affectedCategories = Array.isArray(message?.categories) ? message.categories : [];
  const currentCategory = editCategoryFilter.value;
  const selectedId = selectedSong?.id || null;
  const isRelevant =
    !affectedCategories.length ||
    affectedCategories.includes(currentCategory) ||
    (selectedSong?.category && affectedCategories.includes(selectedSong.category)) ||
    message?.songId === selectedId;

  if (!isRelevant) {
    return;
  }

  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    loadSongs(selectedId).catch((error) => {
      renderError(error instanceof Error ? error.message : String(error));
    });
  }, 250);
}

editCategoryFilter.addEventListener("change", () => {
  selectedSong = null;
  loadSongs().catch((error) => {
    editSongList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
    renderError(error instanceof Error ? error.message : String(error));
  });
});

editForm.addEventListener("submit", saveSong);
deleteButton.addEventListener("click", () => {
  deleteCurrentSong().catch((error) => {
    renderError(error instanceof Error ? error.message : String(error));
  });
});

loadCategories()
  .then(async () => {
    const urlSongId = new URLSearchParams(window.location.search).get("id");

    if (urlSongId) {
      try {
        const response = await fetch(`/api/songs/${encodeURIComponent(urlSongId)}`);
        const payload = await response.json();

        if (response.ok && payload.song?.category) {
          editCategoryFilter.value = payload.song.category;
        }
      } catch {}
    }

    return loadSongs(urlSongId);
  })
  .catch((error) => {
    renderError(error instanceof Error ? error.message : String(error));
  });

window.songAdminSync?.subscribe((message) => {
  scheduleExternalRefresh(message);
});
