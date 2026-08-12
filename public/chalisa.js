/* ══════════════════════════════════════════════════════════
   chalisa.js  –  Shared frontend logic for Durga & Shani admin
   ══════════════════════════════════════════════════════════ */

/**
 * Initialize the chalisa admin page for a given type ("durga" | "shani").
 * Called by each page's inline script.
 * @param {"durga"|"shani"} type
 */
function initChalisaPage(type) {
  const API_BASE = `/chalisa-api/${type}/songs`;

  // ── DOM refs ───────────────────────────────────────────────
  const uploadForm   = document.getElementById("upload-form");
  const audioInput   = document.getElementById("audio-input");
  const uploadBtn    = document.getElementById("upload-btn");
  const resetBtn     = document.getElementById("reset-btn");
  const statusBadge  = document.getElementById("status-badge");
  const resultBox    = document.getElementById("result-box");
  const progressWrap = document.getElementById("progress-wrap");
  const progressBar  = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const songList     = document.getElementById("song-list");
  const songCount    = document.getElementById("song-count");
  const refreshBtn   = document.getElementById("refresh-btn");

  // ── Status helpers ─────────────────────────────────────────
  function setStatus(label, cls) {
    statusBadge.textContent = label;
    statusBadge.className = `badge ${cls}`;
  }

  function showResult(text) {
    resultBox.textContent = text;
    resultBox.style.display = "block";
  }

  function hideResult() {
    resultBox.textContent = "";
    resultBox.style.display = "none";
  }

  function setProgress(pct) {
    progressWrap.style.display = "block";
    progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
  }

  function hideProgress() {
    progressWrap.style.display = "none";
    progressBar.style.width = "0%";
  }

  // ── XHR upload with progress ──────────────────────────────
  function uploadWithProgress(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", API_BASE);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.addEventListener("load", () => {
        let payload;
        try { payload = JSON.parse(xhr.responseText || "{}"); }
        catch { payload = { error: "Invalid server response." }; }

        if (xhr.status >= 200 && xhr.status < 300) { resolve(payload); return; }
        reject(new Error(payload.error || "Upload failed."));
      });

      xhr.addEventListener("error", () => reject(new Error("Request failed.")));
      xhr.send(formData);
    });
  }

  // ── Upload handler ─────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault();

    if (!audioInput.files || audioInput.files.length === 0) {
      setStatus("Error", "error");
      showResult("Please select an audio file.");
      return;
    }

    const formData = new FormData();
    formData.append("audioFile", audioInput.files[0]);

    uploadBtn.disabled = true;
    setStatus("Uploading…", "busy");
    hideResult();
    setProgress(0);

    try {
      const result = await uploadWithProgress(formData, (pct) => setProgress(pct));

      if (result.status === "skipped") {
        setStatus("Skipped", "idle");
        showResult(`Skipped: ${result.reason}\nTitle: ${result.title}\nArtist: ${result.artist}`);
      } else {
        setStatus("Uploaded!", "success");
        showResult(JSON.stringify(result, null, 2));
        uploadForm.reset();
        await loadSongs();
      }
    } catch (err) {
      setStatus("Error", "error");
      showResult(err instanceof Error ? err.message : String(err));
    } finally {
      uploadBtn.disabled = false;
      hideProgress();
    }
  }

  // ── Reset ──────────────────────────────────────────────────
  function handleReset() {
    uploadForm.reset();
    setStatus("Ready", "idle");
    hideResult();
    hideProgress();
  }

  // ── Format duration helper ─────────────────────────────────
  function formatDuration(seconds) {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── Delete a song ──────────────────────────────────────────
  async function deleteSong(id, title) {
    if (!confirm(`Delete "${title}"?\n\nThis will permanently remove the audio and cover from R2.`)) return;

    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      const payload = await res.json();

      if (!res.ok) throw new Error(payload.error || "Delete failed.");

      await loadSongs();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  // ── Render a single song card ──────────────────────────────
  function renderSongCard(song) {
    const card = document.createElement("div");
    card.className = "song-item";
    card.dataset.songId = song.id;

    const coverHtml = song.imageUrl
      ? `<img src="${escHtml(song.imageUrl)}" alt="${escHtml(song.title)}" style="width: 76px; height: 76px; border-radius: 12px; object-fit: cover;" />`
      : `<div style="width: 76px; height: 76px; border-radius: 12px; background: rgba(82, 51, 24, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🎵</div>`;

    card.innerHTML = `
      ${coverHtml}
      <div class="song-item__content" style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
        ${song.titleHindi ? `<div style="font-size: 0.9rem; color: var(--accent); font-weight: 700;">${escHtml(song.titleHindi)}</div>` : ""}
        <strong style="font-size: 1.1rem; color: var(--ink);">${escHtml(song.title)}</strong>
        <span style="color: var(--muted); font-size: 0.9rem;">${escHtml(song.artist)} &bull; ${formatDuration(song.durationSeconds)}</span>
        <audio controls preload="none" src="${escHtml(song.audioUrl)}" style="width: 100%; margin-top: 8px; accent-color: var(--accent);"></audio>
        <div class="actions" style="margin-top: 8px;">
          <button class="danger-button delete-btn" data-id="${escHtml(song.id)}" data-title="${escHtml(song.title)}" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 999px;">Delete</button>
        </div>
      </div>
    `;

    card.querySelector(".delete-btn").addEventListener("click", () => deleteSong(song.id, song.title));
    return card;
  }

  // ── Load & render song list ────────────────────────────────
  async function loadSongs() {
    songList.innerHTML = `<div class="song-list__empty">Loading songs...</div>`;

    try {
      const res = await fetch(API_BASE, { cache: "no-cache" });
      const payload = await res.json();

      if (!res.ok) throw new Error(payload.error || "Failed to load songs.");

      const songs = payload.songs || [];

      if (songCount) songCount.textContent = songs.length;

      if (songs.length === 0) {
        songList.innerHTML = `
          <div class="song-list__empty">
            No songs uploaded yet. Use the form above to add the first one.
          </div>`;
        return;
      }

      songList.innerHTML = "";

      for (const song of songs) {
        songList.appendChild(renderSongCard(song));
      }
    } catch (err) {
      songList.innerHTML = `
        <div class="song-list__empty" style="color:var(--danger)">
          Error loading songs: ${escHtml(err instanceof Error ? err.message : String(err))}
        </div>`;
    }
  }

  // ── XSS escape ────────────────────────────────────────────
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Wire events ────────────────────────────────────────────
  uploadForm.addEventListener("submit", handleUpload);
  resetBtn.addEventListener("click", handleReset);
  if (refreshBtn) refreshBtn.addEventListener("click", loadSongs);

  // ── Initial load ───────────────────────────────────────────
  loadSongs();
}
