const categorySelect = document.getElementById("player-category");
const songList = document.getElementById("song-list");
const emptyPlayer = document.getElementById("empty-player");
const playerCard = document.getElementById("player-card");
const playerCover = document.getElementById("player-cover");
const playerTitle = document.getElementById("player-title");
const playerArtist = document.getElementById("player-artist");
const playerCategoryLabel = document.getElementById("player-category-label");
const playerAudio = document.getElementById("player-audio");
const playerEditLink = document.getElementById("player-edit-link");
const playerLanguage = document.getElementById("player-language");

let categories = [];
let songs = [];
let currentLanguage = "en";
let selectedSongId = null;
let refreshTimer = null;

function formatCategoryLabel(value) {
  const category = categories.find((item) => item.value === value);
  return category ? category.label : value;
}

function renderSongs() {
  songList.innerHTML = "";

  if (!songs.length) {
    const empty = document.createElement("div");
    empty.className = "song-list__empty";
    empty.textContent = "No songs found in this category yet.";
    songList.appendChild(empty);
    return;
  }

  for (const song of songs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song-item";
    button.innerHTML = `
      <img src="" data-src="${song.imageUrl}" data-lazy-image="true" alt="${song.title}" />
      <div class="song-item__content">
        <strong>${song.displayTitle || song.title}</strong>
        <span>${song.artist}</span>
      </div>
    `;
    button.addEventListener("click", () => selectSong(song));
    songList.appendChild(button);
  }

  window.songAdminLazyImages?.upgrade(songList);
}

function selectSong(song) {
  selectedSongId = song.id;
  emptyPlayer.classList.add("is-hidden");
  playerCard.classList.remove("is-hidden");
  playerCover.src = song.imageUrl;
  playerCover.alt = song.title;
  playerTitle.textContent = song.displayTitle || song.title;
  playerArtist.textContent = song.artist;
  playerCategoryLabel.textContent = formatCategoryLabel(song.category);
  playerAudio.src = song.audioUrl;
  playerEditLink.href = `/edit.html?id=${encodeURIComponent(song.id)}`;
}

async function loadCategories() {
  const response = await fetch("/api/categories", { cache: "no-cache" });
  const payload = await response.json();

  categories = payload.categories || [];
  categorySelect.innerHTML = "";

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    categorySelect.appendChild(option);
  }
}

async function loadSongs(options = {}) {
  const category = categorySelect.value;
  const response = await fetch(
    `/api/songs?category=${encodeURIComponent(category)}&limit=100&lang=${encodeURIComponent(currentLanguage)}`,
    { cache: "no-cache" },
  );
  const payload = await response.json();
  songs = payload.songs || [];
  renderSongs();

  if (songs.length) {
    const nextSong =
      (options.preserveSelection !== false && selectedSongId
        ? songs.find((song) => song.id === selectedSongId)
        : null) || songs[0];

    selectSong(nextSong);
  } else {
    selectedSongId = null;
    emptyPlayer.classList.remove("is-hidden");
    playerCard.classList.add("is-hidden");
    playerAudio.removeAttribute("src");
    playerAudio.load();
  }
}

function scheduleExternalRefresh(message) {
  const currentCategory = categorySelect.value;
  const affectedCategories = Array.isArray(message?.categories) ? message.categories : [];

  if (affectedCategories.length && !affectedCategories.includes(currentCategory)) {
    return;
  }

  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    loadSongs({ preserveSelection: true }).catch((error) => {
      songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
    });
  }, 60);
}

categorySelect.addEventListener("change", () => {
  loadSongs().catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });
});

playerLanguage.addEventListener("change", () => {
  currentLanguage = playerLanguage.value;
  loadSongs().catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });
});

loadCategories()
  .then(() => loadSongs())
  .catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });

window.songAdminSync?.subscribe((message) => {
  scheduleExternalRefresh(message);
});
