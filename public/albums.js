const albumCreateTrigger = document.getElementById("album-create-trigger");
const albumList = document.getElementById("album-list");
const albumStatusBadge = document.getElementById("album-status-badge");
const albumDetailPanel = document.getElementById("album-detail-panel");
const albumEmptyPanel = document.getElementById("album-empty-panel");
const albumDetailCover = document.getElementById("album-detail-cover");
const albumDetailCategory = document.getElementById("album-detail-category");
const albumDetailName = document.getElementById("album-detail-name");
const albumDetailCount = document.getElementById("album-detail-count");
const albumDetailSongs = document.getElementById("album-detail-songs");
const albumAddSongsButton = document.getElementById("album-add-songs-button");
const albumRemoveSongsButton = document.getElementById("album-remove-songs-button");
const albumRenameButton = document.getElementById("album-rename-button");
const albumDeleteButton = document.getElementById("album-delete-button");
const albumModalBackdrop = document.getElementById("album-modal-backdrop");
const albumModalEyebrow = document.getElementById("album-modal-eyebrow");
const albumModalTitle = document.getElementById("album-modal-title");
const albumModalBody = document.getElementById("album-modal-body");
const albumModalActions = document.getElementById("album-modal-actions");
const albumModalClose = document.getElementById("album-modal-close");

let categories = [];
let albums = [];
let selectedAlbum = null;
let categorySongs = [];
let refreshTimer = null;

function setStatus(label, className) {
  albumStatusBadge.textContent = label;
  albumStatusBadge.className = `badge ${className}`;
}

function getCategoryLabel(value) {
  return categories.find((category) => category.value === value)?.label || value;
}

function openModal(options) {
  albumModalEyebrow.textContent = options.eyebrow || "";
  albumModalTitle.textContent = options.title || "";
  albumModalBody.innerHTML = "";
  albumModalActions.innerHTML = "";

  if (options.body) {
    albumModalBody.appendChild(options.body);
  }

  for (const action of options.actions || []) {
    const button = document.createElement("button");
    button.type = action.type || "button";
    if (action.className) {
      button.className = action.className;
    }
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    albumModalActions.appendChild(button);
  }

  albumModalBackdrop.classList.remove("is-hidden");
  document.documentElement.classList.add("popup-page-lock");
  document.body.classList.add("popup-page-lock");
}

function closeModal() {
  albumModalBackdrop.classList.add("is-hidden");
  albumModalBody.innerHTML = "";
  albumModalActions.innerHTML = "";
  document.documentElement.classList.remove("popup-page-lock");
  document.body.classList.remove("popup-page-lock");
}

function buildField(labelText, inputElement) {
  const label = document.createElement("label");
  label.className = "field";

  const span = document.createElement("span");
  span.textContent = labelText;
  label.appendChild(span);
  label.appendChild(inputElement);

  return label;
}

function renderAlbumList() {
  albumList.innerHTML = "";

  if (!albums.length) {
    albumList.innerHTML = '<div class="song-list__empty">No albums found in this category yet.</div>';
    return;
  }

  for (const album of albums) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `album-simple-card${selectedAlbum?.id === album.id ? " is-active" : ""}`;
    button.innerHTML = `
      <img src="" data-src="${album.imageUrl}" data-lazy-image="true" alt="${album.name}" />
      <div class="album-simple-card__content">
        <strong>${album.name}</strong>
        <span>${getCategoryLabel(album.category)}</span>
        <small>${album.songCount} song(s)</small>
      </div>
    `;
    button.addEventListener("click", () => {
      loadAlbum(album.id).catch((error) => {
        renderError(error instanceof Error ? error.message : String(error));
      });
    });
    albumList.appendChild(button);
  }

  window.songAdminLazyImages?.upgrade(albumList);
}

function renderSelectedAlbum() {
  if (!selectedAlbum) {
    albumDetailPanel.classList.add("is-hidden");
    albumEmptyPanel.classList.remove("is-hidden");
    albumDetailSongs.innerHTML = "";
    return;
  }

  albumEmptyPanel.classList.add("is-hidden");
  albumDetailPanel.classList.remove("is-hidden");
  albumDetailCover.src = selectedAlbum.imageUrl;
  albumDetailCover.alt = selectedAlbum.name;
  albumDetailCategory.textContent = getCategoryLabel(selectedAlbum.category);
  albumDetailName.textContent = selectedAlbum.name;
  albumDetailCount.textContent = `${selectedAlbum.songCount} song(s) inside this album`;
  albumDetailSongs.innerHTML = "";

  if (!selectedAlbum.songs?.length) {
    albumDetailSongs.innerHTML = '<div class="song-list__empty">No songs added to this album yet.</div>';
    return;
  }

  for (const song of selectedAlbum.songs) {
    const row = document.createElement("div");
    row.className = "album-simple-song";
    row.innerHTML = `
      <img src="" data-src="${song.imageUrl}" data-lazy-image="true" alt="${song.title}" />
      <div class="album-simple-song__content">
        <strong>${song.title}</strong>
        <span>${song.artist}</span>
      </div>
    `;
    albumDetailSongs.appendChild(row);
  }

  window.songAdminLazyImages?.upgrade(albumDetailSongs);
}

function renderError(message) {
  setStatus("Error", "error");
  window.adminPopup?.error(message, "Album Error");
}

async function loadCategories() {
  const response = await fetch("/api/categories", { cache: "no-cache" });
  const payload = await response.json();
  categories = payload.categories || [];
}

async function loadAllSongs() {
  const response = await fetch("/api/songs?limit=500&lang=en", {
    cache: "no-cache",
  });
  const payload = await response.json();
  categorySongs = payload.songs || [];
}

async function loadAlbums(preferredAlbumId = null) {
  const response = await fetch("/api/albums?limit=200&lang=en", { cache: "no-cache" });
  const payload = await response.json();
  albums = payload.albums || [];
  renderAlbumList();

  if (preferredAlbumId) {
    const match = albums.find((album) => album.id === preferredAlbumId);

    if (match) {
      await loadAlbum(match.id);
      return;
    }
  }

  if (selectedAlbum) {
    const match = albums.find((album) => album.id === selectedAlbum.id);

    if (match) {
      await loadAlbum(match.id);
      return;
    }
  }

  selectedAlbum = null;
  renderSelectedAlbum();
  setStatus("Idle", "idle");
}

async function loadAlbum(albumId) {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}?lang=en`, { cache: "no-cache" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load album.");
  }

  selectedAlbum = payload.album;
  await loadAllSongs();
  renderAlbumList();
  renderSelectedAlbum();
  setStatus("Loaded", "idle");
}

function startCreateAlbumFlow() {
  const draft = {
    name: "",
    category: categories[0]?.value || "",
    file: null,
  };

  function stepName() {
    const input = document.createElement("input");
    input.type = "text";
    input.value = draft.name;
    input.required = true;

    const body = document.createElement("div");
    body.className = "album-flow";
    body.appendChild(buildField("Album Name", input));

    openModal({
      eyebrow: "Create Album",
      title: "Step 1 of 3",
      body,
      actions: [
        {
          label: "Cancel",
          className: "secondary",
          onClick: closeModal,
        },
        {
          label: "Next",
          onClick: () => {
            if (!input.value.trim()) {
              window.adminPopup?.error("Album name is required.", "Album Error");
              return;
            }

            draft.name = input.value.trim();
            stepCategory();
          },
        },
      ],
    });
  }

  function stepCategory() {
    const select = document.createElement("select");

    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category.value;
      option.textContent = category.label;
      select.appendChild(option);
    }

    select.value = draft.category;

    const body = document.createElement("div");
    body.className = "album-flow";
    body.appendChild(buildField("Category", select));

    openModal({
      eyebrow: "Create Album",
      title: "Step 2 of 3",
      body,
      actions: [
        {
          label: "Back",
          className: "secondary",
          onClick: stepName,
        },
        {
          label: "Next",
          onClick: () => {
            draft.category = select.value;
            stepCover();
          },
        },
      ],
    });
  }

  function stepCover() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp,image/*";

    const helper = document.createElement("p");
    helper.className = "summary";
    helper.textContent = "Select one cover image for this album.";

    const body = document.createElement("div");
    body.className = "album-flow";
    body.appendChild(buildField("Cover Image", input));
    body.appendChild(helper);

    openModal({
      eyebrow: "Create Album",
      title: "Step 3 of 3",
      body,
      actions: [
        {
          label: "Back",
          className: "secondary",
          onClick: stepCategory,
        },
        {
          label: "Create Album",
          onClick: async () => {
            try {
              if (!input.files?.[0]) {
                window.adminPopup?.error("Cover image is required.", "Album Error");
                return;
              }

              draft.file = input.files[0];
              await createAlbum(draft);
            } catch (error) {
              renderError(error instanceof Error ? error.message : String(error));
            }
          },
        },
      ],
    });
  }

  stepName();
}

async function createAlbum(draft) {
  const formData = new FormData();
  formData.append("name", draft.name);
  formData.append("category", draft.category);
  formData.append("imageFile", draft.file);
  setStatus("Saving", "busy");

  const response = await fetch("/api/albums?lang=en", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to create album.");
  }

  closeModal();
  await loadAllSongs();
  await loadAlbums(payload.album.id);
  await window.adminPopup?.success("Album created successfully.", "Album Created");
  window.songAdminSync?.publish({
    type: "albums:changed",
    reason: "create",
    categories: [payload.album.category],
    albumId: payload.album.id,
  });
  setStatus("Saved", "success");
}

function buildSongChecklist(songs, selectedIds = new Set()) {
  const shell = document.createElement("div");
  shell.className = "album-picker";

  const searchWrap = document.createElement("div");
  searchWrap.className = "album-picker__search";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search songs";

  const helper = document.createElement("p");
  helper.className = "summary album-picker__summary";

  searchWrap.appendChild(buildField("Search", searchInput));
  searchWrap.appendChild(helper);
  shell.appendChild(searchWrap);

  const wrap = document.createElement("div");
  wrap.className = "album-checklist";
  shell.appendChild(wrap);

  if (!songs.length) {
    helper.textContent = "0 songs";
    wrap.innerHTML = '<div class="song-list__empty">No songs available for this action.</div>';
    return {
      wrap: shell,
      focusSearch() {
        searchInput.focus();
      },
      getCheckedIds() {
        return [];
      },
    };
  }

  const rows = [];

  for (const song of songs) {
    const row = document.createElement("label");
    row.className = "album-checklist__item";
    row.dataset.searchText = `${song.title} ${song.artist} ${song.categoryLabel || ""}`.toLowerCase();
    row.innerHTML = `
      <input type="checkbox" value="${song.id}" ${selectedIds.has(song.id) ? "checked" : ""} />
      <img src="" data-src="${song.imageUrl}" data-lazy-image="true" alt="${song.title}" />
      <div class="album-checklist__copy">
        <strong>${song.title}</strong>
        <span>${song.artist}</span>
      </div>
    `;
    wrap.appendChild(row);
    rows.push(row);
  }

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    for (const row of rows) {
      const matches = !query || row.dataset.searchText.includes(query);
      row.classList.toggle("is-hidden", !matches);

      if (matches) {
        visibleCount += 1;
      }
    }

    helper.textContent = `${visibleCount} song(s) shown`;
  }

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
  window.songAdminLazyImages?.upgrade(wrap);

  return {
    wrap: shell,
    focusSearch() {
      searchInput.focus();
    },
    getCheckedIds() {
      return [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    },
  };
}

function openAddSongsModal() {
  if (!selectedAlbum) {
    return;
  }

  const selectedSongIds = new Set((selectedAlbum.songs || []).map((song) => song.id));
  const availableSongs = categorySongs.filter((song) => !selectedSongIds.has(song.id));
  const checklist = buildSongChecklist(availableSongs);

  openModal({
    eyebrow: "Add Songs",
    title: `Add songs to ${selectedAlbum.name}`,
    body: checklist.wrap,
    actions: [
      {
        label: "Cancel",
        className: "secondary",
        onClick: closeModal,
      },
      {
        label: "Add Songs",
        onClick: async () => {
          try {
            const ids = checklist.getCheckedIds();

            if (!ids.length) {
              window.adminPopup?.error("Select at least one song to add.", "Album Error");
              return;
            }

            await updateAlbumSongs(ids, "add");
          } catch (error) {
            renderError(error instanceof Error ? error.message : String(error));
          }
        },
      },
    ],
  });

  checklist.focusSearch();
}

function openRemoveSongsModal() {
  if (!selectedAlbum) {
    return;
  }

  const checklist = buildSongChecklist(selectedAlbum.songs || []);

  openModal({
    eyebrow: "Remove Songs",
    title: `Remove songs from ${selectedAlbum.name}`,
    body: checklist.wrap,
    actions: [
      {
        label: "Cancel",
        className: "secondary",
        onClick: closeModal,
      },
      {
        label: "Remove Songs",
        className: "danger-button",
        onClick: async () => {
          try {
            const ids = checklist.getCheckedIds();

            if (!ids.length) {
              window.adminPopup?.error("Select at least one song to remove.", "Album Error");
              return;
            }

            await updateAlbumSongs(ids, "remove");
          } catch (error) {
            renderError(error instanceof Error ? error.message : String(error));
          }
        },
      },
    ],
  });

  checklist.focusSearch();
}

async function updateAlbumSongs(songIds, mode) {
  if (!selectedAlbum) {
    return;
  }

  setStatus("Saving", "busy");

  for (const songId of songIds) {
    const response = await fetch(
      mode === "add"
        ? `/api/albums/${encodeURIComponent(selectedAlbum.id)}/songs?lang=en`
        : `/api/albums/${encodeURIComponent(selectedAlbum.id)}/songs/${encodeURIComponent(songId)}?lang=en`,
      {
        method: mode === "add" ? "POST" : "DELETE",
        headers: mode === "add" ? { "Content-Type": "application/json" } : {},
        body: mode === "add" ? JSON.stringify({ songId }) : undefined,
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to update album songs.");
    }

    selectedAlbum = payload.album;
  }

  closeModal();
  await loadAlbum(selectedAlbum.id);
  await window.adminPopup?.success(
    mode === "add" ? "Songs added to the album." : "Songs removed from the album.",
    mode === "add" ? "Songs Added" : "Songs Removed",
  );
  window.songAdminSync?.publish({
    type: "albums:changed",
    reason: mode === "add" ? "add-song" : "remove-song",
    categories: [selectedAlbum.category],
    albumId: selectedAlbum.id,
  });
  setStatus("Saved", "success");
}

function openRenameModal() {
  if (!selectedAlbum) {
    return;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.value = selectedAlbum.name;

  const body = document.createElement("div");
  body.className = "album-flow";
  body.appendChild(buildField("Album Name", input));

  openModal({
    eyebrow: "Change Name",
    title: `Rename ${selectedAlbum.name}`,
    body,
    actions: [
      {
        label: "Cancel",
        className: "secondary",
        onClick: closeModal,
      },
      {
        label: "Save Name",
        onClick: async () => {
          try {
            if (!input.value.trim()) {
              window.adminPopup?.error("Album name is required.", "Album Error");
              return;
            }

            setStatus("Saving", "busy");
            const response = await fetch(`/api/albums/${encodeURIComponent(selectedAlbum.id)}?lang=en`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: input.value.trim(),
              }),
            });
            const payload = await response.json();

            if (!response.ok) {
              throw new Error(payload.error || "Unable to rename album.");
            }

            closeModal();
            await loadAlbum(payload.album.id);
            await loadAlbums(payload.album.id);
            await window.adminPopup?.success("Album name updated successfully.", "Album Saved");
            window.songAdminSync?.publish({
              type: "albums:changed",
              reason: "rename",
              categories: [payload.album.category],
              albumId: payload.album.id,
            });
            setStatus("Saved", "success");
          } catch (error) {
            renderError(error instanceof Error ? error.message : String(error));
          }
        },
      },
    ],
  });
}

async function deleteAlbum() {
  if (!selectedAlbum) {
    return;
  }

  const confirmed = await window.adminPopup.confirm({
    title: "Delete Album",
    message: "Delete this album? Songs will stay in the category. Only the album will be removed.",
    confirmText: "Delete",
    cancelText: "Cancel",
    danger: true,
    icon: "!",
  });

  if (!confirmed) {
    return;
  }

  setStatus("Deleting", "busy");
  const category = selectedAlbum.category;
  const albumId = selectedAlbum.id;

  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}`, {
    method: "DELETE",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to delete album.");
  }

  selectedAlbum = null;
  await loadAlbums();
  await window.adminPopup?.success("Album deleted successfully.", "Album Deleted");
  window.songAdminSync?.publish({
    type: "albums:changed",
    reason: "delete",
    categories: [category],
    albumId,
  });
  setStatus("Saved", "success");
}

function scheduleExternalRefresh(message) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    loadAlbums(selectedAlbum?.id || null).catch((error) => {
      renderError(error instanceof Error ? error.message : String(error));
    });
  }, 60);
}

albumCreateTrigger.addEventListener("click", () => {
  startCreateAlbumFlow();
});

albumAddSongsButton.addEventListener("click", () => {
  openAddSongsModal();
});

albumRemoveSongsButton.addEventListener("click", () => {
  openRemoveSongsModal();
});

albumRenameButton.addEventListener("click", () => {
  openRenameModal();
});

albumDeleteButton.addEventListener("click", () => {
  deleteAlbum().catch((error) => {
    renderError(error instanceof Error ? error.message : String(error));
  });
});

albumModalBackdrop.addEventListener("click", (event) => {
  if (event.target === albumModalBackdrop) {
    closeModal();
  }
});

albumModalClose.addEventListener("click", () => {
  closeModal();
});

loadCategories()
  .then(() => loadAllSongs())
  .then(() => loadAlbums())
  .catch((error) => {
    renderError(error instanceof Error ? error.message : String(error));
  });

window.songAdminSync?.subscribe((message) => {
  scheduleExternalRefresh(message);
});
