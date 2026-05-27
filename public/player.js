const categorySelect = document.getElementById("player-category");
const albumList = document.getElementById("album-list");
const songList = document.getElementById("song-list");
const albumEmpty = document.getElementById("album-empty");
const albumCard = document.getElementById("album-card");
const albumCover = document.getElementById("album-cover");
const albumTitle = document.getElementById("album-title");
const albumCategoryLabel = document.getElementById("album-category-label");
const albumCount = document.getElementById("album-count");
const albumSongList = document.getElementById("album-song-list");
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
let albums = [];
let selectedAlbum = null;
let selectedAlbumId = null;
let currentLanguage = "en";
let selectedSongId = null;
let refreshTimer = null;

function formatCategoryLabel(value) {
  const category = categories.find((item) => item.value === value);
  return category ? category.label : value;
}

function createSongButton(song, onClick) {
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
  button.addEventListener("click", onClick);
  return button;
}

function renderDirectSongs() {
  songList.innerHTML = "";

  if (!songs.length) {
    const empty = document.createElement("div");
    empty.className = "song-list__empty";
    empty.textContent = "No direct songs found in this category yet.";
    songList.appendChild(empty);
    return;
  }

  for (const song of songs) {
    const button = createSongButton(song, () => selectSong(song));
    songList.appendChild(button);
  }

  window.songAdminLazyImages?.upgrade(songList);
}

function renderAlbums() {
  albumList.innerHTML = "";

  if (!albums.length) {
    albumList.innerHTML = '<div class="song-list__empty">No albums found in this category yet.</div>';
    return;
  }

  for (const album of albums) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `album-tile${selectedAlbumId === album.id ? " is-active" : ""}`;
    button.innerHTML = `
      <img src="" data-src="${album.imageUrl}" data-lazy-image="true" alt="${album.name}" />
      <div class="album-tile__content">
        <strong>${album.name}</strong>
        <span>${album.songCount} song(s)</span>
      </div>
    `;
    button.addEventListener("click", () => {
      loadAlbumDetail(album.id).catch((error) => {
        albumSongList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
      });
    });
    albumList.appendChild(button);
  }

  window.songAdminLazyImages?.upgrade(albumList);
}

function renderAlbumSongs() {
  albumSongList.innerHTML = "";

  if (!selectedAlbum) {
    albumEmpty.classList.remove("is-hidden");
    albumCard.classList.add("is-hidden");
    return;
  }

  albumEmpty.classList.add("is-hidden");
  albumCard.classList.remove("is-hidden");
  albumCover.src = selectedAlbum.imageUrl;
  albumCover.alt = selectedAlbum.name;
  albumTitle.textContent = selectedAlbum.name;
  albumCategoryLabel.textContent = selectedAlbum.categoryLabel || formatCategoryLabel(selectedAlbum.category);
  albumCount.textContent = `${selectedAlbum.songCount} song(s) in this album`;

  if (!selectedAlbum.songs.length) {
    albumSongList.innerHTML = '<div class="song-list__empty">No songs added to this album yet.</div>';
    return;
  }

  for (const song of selectedAlbum.songs) {
    const button = createSongButton(song, () => selectSong(song));
    albumSongList.appendChild(button);
  }

  window.songAdminLazyImages?.upgrade(albumSongList);
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

  const requestedCategory = new URLSearchParams(window.location.search).get("category");

  if (requestedCategory && categories.some((category) => category.value === requestedCategory)) {
    categorySelect.value = requestedCategory;
  }
}

async function loadAlbumDetail(albumId) {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}?lang=${encodeURIComponent(currentLanguage)}`, {
    cache: "no-cache",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load album.");
  }

  selectedAlbum = payload.album;
  selectedAlbumId = payload.album.id;
  renderAlbums();
  renderAlbumSongs();

  if (selectedAlbum.songs.length) {
    const nextSong =
      (selectedSongId ? selectedAlbum.songs.find((song) => song.id === selectedSongId) : null) ||
      songs.find((song) => song.id === selectedSongId) ||
      selectedAlbum.songs[0];
    selectSong(nextSong);
  }
}

async function loadCategoryData(options = {}) {
  const category = categorySelect.value;
  const [songsResponse, albumsResponse] = await Promise.all([
    fetch(`/api/songs?category=${encodeURIComponent(category)}&limit=100&lang=${encodeURIComponent(currentLanguage)}`, {
      cache: "no-cache",
    }),
    fetch(`/api/albums?category=${encodeURIComponent(category)}&limit=100&lang=${encodeURIComponent(currentLanguage)}`, {
      cache: "no-cache",
    }),
  ]);
  const songsPayload = await songsResponse.json();
  const albumsPayload = await albumsResponse.json();

  songs = songsPayload.songs || [];
  albums = albumsPayload.albums || [];
  renderDirectSongs();
  renderAlbums();

  if (songs.length) {
    const nextSong =
      (options.preserveSelection !== false && selectedSongId ? songs.find((song) => song.id === selectedSongId) : null) ||
      songs[0];
    selectSong(nextSong);
  } else {
    selectedSongId = null;
    emptyPlayer.classList.remove("is-hidden");
    playerCard.classList.add("is-hidden");
    playerAudio.removeAttribute("src");
    playerAudio.load();
  }

  if (albums.length) {
    const nextAlbum =
      (options.preserveSelection !== false && selectedAlbumId ? albums.find((album) => album.id === selectedAlbumId) : null) ||
      albums[0];
    await loadAlbumDetail(nextAlbum.id);
  } else {
    selectedAlbum = null;
    selectedAlbumId = null;
    renderAlbumSongs();
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
    loadCategoryData({ preserveSelection: true }).catch((error) => {
      songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
    });
  }, 60);
}

categorySelect.addEventListener("change", () => {
  loadCategoryData().catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });
});

playerLanguage.addEventListener("change", () => {
  currentLanguage = playerLanguage.value;
  loadCategoryData({ preserveSelection: true }).catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });
});

loadCategories()
  .then(() => loadCategoryData())
  .catch((error) => {
    songList.innerHTML = `<div class="song-list__empty">${error instanceof Error ? error.message : String(error)}</div>`;
  });

window.songAdminSync?.subscribe((message) => {
  scheduleExternalRefresh(message);
});
