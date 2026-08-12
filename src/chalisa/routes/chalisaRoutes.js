const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const multer = require("multer");
const {
  uploadChalisaSong,
  listChalisaSongs,
  getChalisaSongById,
  deleteChalisaSong,
} = require("../services/chalisaUploadService");

// ── Multer setup (isolated from main upload flow) ──────────────────────────

const uploadDir = path.join(os.tmpdir(), "chalisa-incoming");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9-_ ]/giu, "")
      .trim()
      .replace(/\s+/gu, "-")
      .toLowerCase() || "file";

    cb(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac"]);
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowed.has(ext)) {
      cb(new Error(`Unsupported file type: ${file.originalname}`));
      return;
    }

    cb(null, true);
  },
});

// ── Helper serializers ─────────────────────────────────────────────────────

function serializeSong(song) {
  return {
    id: String(song._id),
    title: song.title,
    titleHindi: song.titleHindi || "",
    artist: song.artist,
    audioUrl: song.audioUrl,
    imageUrl: song.imageUrl,
    durationSeconds: song.durationSeconds,
    originalFileName: song.originalFileName,
    mimeType: song.mimeType,
    imageMimeType: song.imageMimeType,
    sizeBytes: song.sizeBytes,
    processingMode: song.processingMode,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}

function handleCommonErrors(error, response, next) {
  if (
    error instanceof Error &&
    (error.message === "Song not found." || error.message === "Invalid song id.")
  ) {
    response.status(404).json({ error: error.message });
    return;
  }

  next(error);
}

// ── Router ─────────────────────────────────────────────────────────────────

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "private, no-cache, must-revalidate");
  }

  next();
});

// Health
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "chalisa-api" });
});

// ── Durga Chalisa ──────────────────────────────────────────────────────────

router.get("/durga/songs", async (req, res, next) => {
  try {
    const songs = await listChalisaSongs("durga");
    res.json({ type: "durga", total: songs.length, songs: songs.map(serializeSong) });
  } catch (error) {
    next(error);
  }
});

router.get("/durga/songs/:id", async (req, res, next) => {
  try {
    const song = await getChalisaSongById("durga", req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found." });
      return;
    }

    res.json({ song: serializeSong(song) });
  } catch (error) {
    handleCommonErrors(error, res, next);
  }
});

router.post("/durga/songs", audioUpload.single("audioFile"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "audioFile is required." });
      return;
    }

    const result = await uploadChalisaSong(req.file, "durga");
    res.status(result.status === "uploaded" ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/durga/songs/:id", async (req, res, next) => {
  try {
    const deleted = await deleteChalisaSong("durga", req.params.id);
    res.json({ ok: true, song: deleted });
  } catch (error) {
    handleCommonErrors(error, res, next);
  }
});

// ── Shani Chalisa ──────────────────────────────────────────────────────────

router.get("/shani/songs", async (req, res, next) => {
  try {
    const songs = await listChalisaSongs("shani");
    res.json({ type: "shani", total: songs.length, songs: songs.map(serializeSong) });
  } catch (error) {
    next(error);
  }
});

router.get("/shani/songs/:id", async (req, res, next) => {
  try {
    const song = await getChalisaSongById("shani", req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found." });
      return;
    }

    res.json({ song: serializeSong(song) });
  } catch (error) {
    handleCommonErrors(error, res, next);
  }
});

router.post("/shani/songs", audioUpload.single("audioFile"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "audioFile is required." });
      return;
    }

    const result = await uploadChalisaSong(req.file, "shani");
    res.status(result.status === "uploaded" ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/shani/songs/:id", async (req, res, next) => {
  try {
    const deleted = await deleteChalisaSong("shani", req.params.id);
    res.json({ ok: true, song: deleted });
  } catch (error) {
    handleCommonErrors(error, res, next);
  }
});

module.exports = { router };
