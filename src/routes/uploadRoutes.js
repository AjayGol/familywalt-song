const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const multer = require("multer");
const { getCategories, getCategoryByApiId, getCategoryConfig } = require("../config/categories");
const {
  addSongToAlbum,
  createAlbum,
  deleteAlbum,
  getAlbumById,
  listAlbums,
  removeSongFromAlbum,
  renameAlbum,
} = require("../services/albumService");
const {
  countSongsByCategory,
  deleteSong,
  getSongById,
  listSongs,
  updateSongMetadata,
  uploadManySongs,
  uploadSongFile,
} = require("../services/songUploadService");
const { generateHindiTitle, getDisplayTitle } = require("../lib/titleLocalization");

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
      .toLowerCase() || "file";

    callback(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const audioUpload = multer({
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

const albumImageUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (request, file, callback) => {
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      callback(new Error(`Unsupported image type for ${file.originalname}`));
      return;
    }

    callback(null, true);
  },
});

const router = express.Router();

router.use((request, response, next) => {
  if (request.method === "GET") {
    response.set("Cache-Control", "private, no-cache, must-revalidate");
  }

  next();
});

function getRequestedLanguage(request) {
  return typeof request.query.lang === "string" ? request.query.lang : "en";
}

function serializeMobileSong(song, language = "en") {
  const category = getCategoryConfig(song.category);
  const titleHindi = song.titleHindi || generateHindiTitle(song.title);

  return {
    id: String(song._id),
    title: song.title,
    titleHindi,
    displayTitle: getDisplayTitle({ ...song, titleHindi }, language),
    artist: song.artist,
    category: category?.apiId || song.category,
    imageUrl: song.imageUrl,
    audioUrl: song.audioUrl,
    durationSeconds: song.durationSeconds,
    createdAt: song.createdAt,
  };
}

function serializeAdminSong(song, language = "en") {
  const category = getCategoryConfig(song.category);
  const titleHindi = song.titleHindi || generateHindiTitle(song.title);

  return {
    id: String(song._id),
    title: song.title,
    titleHindi,
    displayTitle: getDisplayTitle({ ...song, titleHindi }, language),
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

function getAlbumSongs(album) {
  if (!album || !Array.isArray(album.songIds)) {
    return [];
  }

  return album.songIds.filter((song) => song && typeof song === "object" && song.title);
}

function serializeAdminAlbum(album, language = "en") {
  const category = getCategoryConfig(album.category);
  const songs = getAlbumSongs(album);

  return {
    id: String(album._id),
    name: album.name,
    category: album.category,
    categoryApiId: category?.apiId || album.category,
    categoryLabel: category?.label || album.category,
    imageUrl: album.imageUrl,
    imageKey: album.imageKey,
    songCount: songs.length || album.songIds?.length || 0,
    songs: songs.map((song) => serializeAdminSong(song, language)),
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

function serializeMobileAlbum(album, language = "en") {
  const category = getCategoryConfig(album.category);
  const songs = getAlbumSongs(album);

  return {
    id: String(album._id),
    name: album.name,
    category: category?.apiId || album.category,
    categoryTitle: category?.label || album.category,
    imageUrl: album.imageUrl,
    songCount: songs.length || album.songIds?.length || 0,
    songs: songs.map((song) => serializeMobileSong(song, language)),
    createdAt: album.createdAt,
  };
}

function handleCommonAlbumError(error, response, next) {
  if (error instanceof Error && (error.message === "Album not found." || error.message === "Invalid album id.")) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (
    error instanceof Error &&
    (error.message === "Album name is required." ||
      error.message === "Invalid category." ||
      error.message === "imageFile is required." ||
      error.message === "Another album with the same name already exists in this category." ||
      error.message === "Invalid song id." ||
      error.message === "Song not found.")
  ) {
    response.status(400).json({ error: error.message });
    return;
  }

  next(error);
}

router.get("/health", (request, response) => {
  response.json({ ok: true });
});

router.get("/categories", (request, response) => {
  response.json({
    categories: getCategories().map((category) => ({
      value: category.value,
      apiId: category.apiId,
      label: category.label,
      description: category.description,
      rootFolder: category.rootFolder,
      albumFolder: category.albumFolder,
      imageFolder: category.imageFolder,
      songFolder: category.songFolder,
    })),
  });
});

router.get("/songs", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const category =
      typeof request.query.category === "string" && request.query.category.trim()
        ? getCategoryConfig(request.query.category)?.value || null
        : null;

    const songs = await listSongs({
      limit: Number(request.query.limit || 100),
      category,
    });

    response.json({ songs: songs.map((song) => serializeAdminSong(song, language)) });
  } catch (error) {
    next(error);
  }
});

router.get("/songs/:songId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const song = await getSongById(request.params.songId);

    if (!song) {
      response.status(404).json({ error: "Song not found." });
      return;
    }

    response.json({ song: serializeAdminSong(song, language) });
  } catch (error) {
    next(error);
  }
});

router.patch("/songs/:songId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const updatedSong = await updateSongMetadata(request.params.songId, request.body || {});
    response.json({
      ok: true,
      song: serializeAdminSong(updatedSong, language),
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

router.delete("/songs/:songId", async (request, response, next) => {
  try {
    const deletedSong = await deleteSong(request.params.songId);
    response.json({
      ok: true,
      song: deletedSong,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Song not found." || error.message === "Invalid song id.")) {
      response.status(404).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.get("/albums", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const category =
      typeof request.query.category === "string" && request.query.category.trim()
        ? getCategoryConfig(request.query.category)?.value || null
        : null;

    const albums = await listAlbums({
      limit: Number(request.query.limit || 100),
      category,
    });

    response.json({
      albums: albums.map((album) => serializeAdminAlbum(album, language)),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/albums/:albumId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const album = await getAlbumById(request.params.albumId);

    if (!album) {
      response.status(404).json({ error: "Album not found." });
      return;
    }

    response.json({
      album: serializeAdminAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.post("/albums", albumImageUpload.single("imageFile"), async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const album = await createAlbum(request.file, request.body || {});
    response.status(201).json({
      ok: true,
      album: serializeAdminAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.patch("/albums/:albumId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const album = await renameAlbum(request.params.albumId, request.body || {});
    response.json({
      ok: true,
      album: serializeAdminAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.delete("/albums/:albumId", async (request, response, next) => {
  try {
    const album = await deleteAlbum(request.params.albumId);
    response.json({
      ok: true,
      album,
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.post("/albums/:albumId/songs", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const album = await addSongToAlbum(request.params.albumId, request.body?.songId);
    response.json({
      ok: true,
      album: serializeAdminAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.delete("/albums/:albumId/songs/:songId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const album = await removeSongFromAlbum(request.params.albumId, request.params.songId);
    response.json({
      ok: true,
      album: serializeAdminAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
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
    const language = getRequestedLanguage(request);
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
      language,
      songs: songs.map((song) => serializeMobileSong(song, language)),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mobile/categories/:categoryId/albums", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const category = getCategoryByApiId(request.params.categoryId);

    if (!category) {
      response.status(404).json({ error: "Category not found." });
      return;
    }

    const albums = await listAlbums({
      limit: Number(request.query.limit || 200),
      category: category.value,
    });

    response.json({
      category: {
        id: category.apiId,
        title: category.label,
        description: category.description,
      },
      total: albums.length,
      language,
      albums: albums.map((album) => serializeMobileAlbum(album, language)),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mobile/categories/:categoryId/albums/:albumId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const category = getCategoryByApiId(request.params.categoryId);

    if (!category) {
      response.status(404).json({ error: "Category not found." });
      return;
    }

    const album = await getAlbumById(request.params.albumId);

    if (!album || album.category !== category.value) {
      response.status(404).json({ error: "Album not found." });
      return;
    }

    response.json({
      album: serializeMobileAlbum(album, language),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.get("/mobile/categories/:categoryId/albums/:albumId/songs", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const category = getCategoryByApiId(request.params.categoryId);

    if (!category) {
      response.status(404).json({ error: "Category not found." });
      return;
    }

    const album = await getAlbumById(request.params.albumId);

    if (!album || album.category !== category.value) {
      response.status(404).json({ error: "Album not found." });
      return;
    }

    const songs = getAlbumSongs(album);

    response.json({
      album: {
        id: String(album._id),
        name: album.name,
        category: category.apiId,
        categoryTitle: category.label,
        imageUrl: album.imageUrl,
      },
      total: songs.length,
      language,
      songs: songs.map((song) => serializeMobileSong(song, language)),
    });
  } catch (error) {
    handleCommonAlbumError(error, response, next);
  }
});

router.get("/mobile/songs/:songId", async (request, response, next) => {
  try {
    const language = getRequestedLanguage(request);
    const song = await getSongById(request.params.songId);

    if (!song) {
      response.status(404).json({ error: "Song not found." });
      return;
    }

    const category = getCategoryConfig(song.category);

    response.json({
      song: {
        ...serializeMobileSong(song, language),
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

router.post("/uploads/song", audioUpload.single("audioFile"), async (request, response, next) => {
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

router.post("/uploads/bulk", audioUpload.array("audioFiles", 200), async (request, response, next) => {
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
