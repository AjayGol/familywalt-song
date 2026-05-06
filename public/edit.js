const editCategoryFilter = document.getElementById("edit-category-filter");
const editSongList = document.getElementById("edit-song-list");
const editEmpty = document.getElementById("edit-empty");
const editFormShell = document.getElementById("edit-form-shell");
const editStatusBadge = document.getElementById("edit-status-badge");
const editForm = document.getElementById("edit-form");
const editSongId = document.getElementById("edit-song-id");
const editTitle = document.getElementById("edit-title");
const editArtist = document.getElementById("edit-artist");
const editCategory = document.getElementById("edit-category");
const editCover = document.getElementById("edit-cover");
const editAudio = document.getElementById("edit-audio");
const editResult = document.getElementById("edit-result");
const editPlayerLink = document.getElementById("edit-player-link");
const saveButton = document.getElementById("save-button");

let categories = [];
let songs = [];
let selectedSong = null;

function setStatus(label, className) {
  editStatusBadge.textContent = label;
  editStatusBadge.className = `badge ${className}`;
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
    button.className = "song-item";
    button.innerHTML = `
      <img src="${song.imageUrl}" alt="${song.title}" />
      <div class="song-item__content">
        <strong>${song.title}</strong>
        <span>${song.artist}</span>
      </div>
    `;
    button.addEventListener("click", () => loadSong(song.id));
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
  const response = await fetch("/api/categories");
  const payload = await response.json();
  categories = payload.categories || [];
  populateCategorySelect(editCategoryFilter);
  populateCategorySelect(editCategory);
}

async function loadSongs() {
  const response = await fetch(`/api/songs?category=${encodeURIComponent(editCategoryFilter.value)}&limit=200`);
  const payload = await response.json();
  songs = payload.songs || [];
  renderSongList();

  const urlSongId = new URLSearchParams(window.location.search).get("id");
  const nextId = urlSongId || songs[0]?.id || null;

  if (nextId) {
    await loadSong(nextId);
  } else {
    editEmpty.classList.remove("is-hidden");
    editFormShell.classList.add("is-hidden");
  }
}

async function loadSong(songId) {
  const response = await fetch(`/api/songs/${encodeURIComponent(songId)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load song.");
  }

  selectedSong = payload.song;
  editEmpty.classList.add("is-hidden");
  editFormShell.classList.remove("is-hidden");
  editSongId.value = selectedSong.id;
  editTitle.value = selectedSong.title;
  editArtist.value = selectedSong.artist;
  editCategory.value = selectedSong.category;
  editCover.src = selectedSong.imageUrl;
  editAudio.src = selectedSong.audioUrl;
  editPlayerLink.href = `/player.html?category=${encodeURIComponent(selectedSong.category)}`;
  editResult.textContent = JSON.stringify(selectedSong, null, 2);
  setStatus("Loaded", "idle");
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

  try {
    const response = await fetch(`/api/songs/${encodeURIComponent(editSongId.value)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle.value,
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
    editCategoryFilter.value = selectedSong.category;
    await loadSongs();
    await loadSong(selectedSong.id);
  } catch (error) {
    setStatus("Error", "error");
    editResult.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    saveButton.disabled = false;
  }
}

editCategoryFilter.addEventListener("change", () => {
  loadSongs().catch((error) => {
    editSongList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });
});

editForm.addEventListener("submit", saveSong);

loadCategories()
  .then(() => loadSongs())
  .catch((error) => {
    setStatus("Error", "error");
    editResult.textContent = error instanceof Error ? error.message : String(error);
  });
