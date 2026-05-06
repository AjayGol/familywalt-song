const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const multer = require("multer");
const { getCategories, getCategoryByApiId, getCategoryConfig } = require("../config/categories");
const { countSongsByCategory, getSongById, listSongs, updateSongMetadata, uploadManySongs, uploadSongFile } = require("../services/songUploadService");

const uploadDir = path.join(os.tmpdir(), "uploadback-incoming");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    callback(null, uploadDir);
  },
  filename: (request, file, callback) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9-_ ]/giu, "")
      .trim()
      .replace(/\s+/gu, "-")
      .toLowerCase() || "song";

    callback(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 200,
  },
  fileFilter: (request, file, callback) => {
    const allowedExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac"]);
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(new Error(`Unsupported file type for ${file.originalname}`));
      return;
    }

    callback(null, true);
  },
});

const router = express.Router();

function serializeMobileSong(song) {
  const category = getCategoryConfig(song.category);

  return {
    id: String(song._id),
    title: song.title,
    artist: song.artist,
    category: category?.apiId || song.category,
    imageUrl: song.imageUrl,
    audioUrl: song.audioUrl,
    durationSeconds: song.durationSeconds,
    createdAt: song.createdAt,
  };
}

function serializeAdminSong(song) {
  const category = getCategoryConfig(song.category);

  return {
    id: String(song._id),
    title: song.title,
    artist: song.artist,
    category: song.category,
    categoryApiId: category?.apiId || song.category,
    categoryLabel: category?.label || song.category,
    imageUrl: song.imageUrl,
    audioUrl: song.audioUrl,
    audioKey: song.audioKey,
    imageKey: song.imageKey,
    durationSeconds: song.durationSeconds,
    originalFileName: song.originalFileName,
    mimeType: song.mimeType,
    imageMimeType: song.imageMimeType,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}

router.get("/health", (request, response) => {
  response.json({ ok: true });
});

router.get("/categories", (request, response) => {
  response.json({
    categories: getCategories().map((category) => ({
      value: category.value,
      label: category.label,
      rootFolder: category.rootFolder,
      imageFolder: category.imageFolder,
      songFolder: category.songFolder,
    })),
  });
});

router.get("/songs", async (request, response, next) => {
  try {
    const category =
      typeof request.query.category === "string" && request.query.category.trim()
        ? getCategoryConfig(request.query.category)?.value || null
        : null;

    const songs = await listSongs({
      limit: Number(request.query.limit || 100),
      category,
    });

    response.json({ songs: songs.map(serializeAdminSong) });
  } catch (error) {
    next(error);
  }
});

router.get("/songs/:songId", async (request, response, next) => {
  try {
    const song = await getSongById(request.params.songId);

    if (!song) {
      response.status(404).json({ error: "Song not found." });
      return;
    }

    response.json({ song: serializeAdminSong(song) });
  } catch (error) {
    next(error);
  }
});

router.patch("/songs/:songId", async (request, response, next) => {
  try {
    const updatedSong = await updateSongMetadata(request.params.songId, request.body || {});
    response.json({
      ok: true,
      song: serializeAdminSong(updatedSong),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Song not found." || error.message === "Invalid song id.")) {
      response.status(404).json({ error: error.message });
      return;
    }

    if (
      error instanceof Error &&
      (error.message === "Title is required." ||
        error.message === "Artist is required." ||
        error.message === "Invalid category." ||
        error.message === "Another song with the same title and artist already exists in this category.")
    ) {
      response.status(400).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.get("/mobile/categories", async (request, response, next) => {
  try {
    const counts = await countSongsByCategory();

    response.json({
      categories: getCategories().map((category) => ({
        id: category.apiId,
        title: category.label,
        description: category.description,
        songCount: counts[category.value] || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mobile/categories/:categoryId/songs", async (request, response, next) => {
  try {
    const category = getCategoryByApiId(request.params.categoryId);

    if (!category) {
      response.status(404).json({ error: "Category not found." });
      return;
    }

    const songs = await listSongs({
      limit: Number(request.query.limit || 500),
      category: category.value,
    });

    response.json({
      category: {
        id: category.apiId,
        title: category.label,
        description: category.description,
      },
      total: songs.length,
      songs: songs.map(serializeMobileSong),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mobile/songs/:songId", async (request, response, next) => {
  try {
    const song = await getSongById(request.params.songId);

    if (!song) {
      response.status(404).json({ error: "Song not found." });
      return;
    }

    const category = getCategoryConfig(song.category);

    response.json({
      song: {
        ...serializeMobileSong(song),
        categoryTitle: category?.label || song.category,
        originalFileName: song.originalFileName,
        mimeType: song.mimeType,
        imageMimeType: song.imageMimeType,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/uploads/song", upload.single("audioFile"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "audioFile is required." });
      return;
    }

    const result = await uploadSongFile(request.file, request.body.category);
    response.status(result.status === "uploaded" ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/uploads/bulk", upload.array("audioFiles", 200), async (request, response, next) => {
  try {
    const files = Array.isArray(request.files) ? request.files : [];

    if (!files.length) {
      response.status(400).json({ error: "audioFiles are required." });
      return;
    }

    const results = await uploadManySongs(files, request.body.category);
    response.status(201).json({
      total: results.length,
      uploaded: results.filter((result) => result.status === "uploaded").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  router,
};
