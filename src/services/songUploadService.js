const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { getCategoryConfig } = require("../config/categories");
const { Song } = require("../models/song");
const { prepareUploadAssets } = require("../lib/media");
const { deleteObject, ensureCategoryFoldersExist, putObject } = require("../lib/r2");

function normalizeText(value) {
  return `${value || ""}`.trim().toLowerCase();
}

async function cleanupUploadedFile(filePath) {
  if (!filePath) {
    return;
  }

  await fs.rm(filePath, { force: true });
}

async function uploadSongFile(file, categoryInput, options = {}) {
  const category = getCategoryConfig(categoryInput);

  if (!category) {
    throw new Error("Invalid category.");
  }

  await ensureCategoryFoldersExist();

  const prepared = await prepareUploadAssets(file.path, file.originalname);
  const normalizedTitle = normalizeText(prepared.title);
  const normalizedArtist = normalizeText(prepared.artist);

  const existingSong = await Song.findOne({
    category: category.value,
    normalizedTitle,
    normalizedArtist,
  }).lean();

  if (existingSong) {
    return {
      status: "skipped",
      reason: "Song with same title and artist already exists in this category.",
      title: prepared.title,
      artist: prepared.artist,
      category: category.value,
      originalFileName: file.originalname,
    };
  }

  const songId = randomUUID();
  const audioKey = `songs/${category.rootFolder}/${category.songFolder}/${songId}${prepared.processedAudio.extension}`;
  const imageKey = `songs/${category.rootFolder}/${category.imageFolder}/${songId}${prepared.cover.extension}`;

  let audioUrl = null;
  let imageUrl = null;

  try {
    [audioUrl, imageUrl] = await Promise.all([
      putObject({
        key: audioKey,
        body: prepared.processedAudio.buffer,
        contentType: prepared.processedAudio.contentType,
      }),
      putObject({
        key: imageKey,
        body: prepared.cover.buffer,
        contentType: prepared.cover.contentType,
      }),
    ]);

    const song = await Song.create({
      title: prepared.title,
      artist: prepared.artist,
      normalizedTitle,
      normalizedArtist,
      category: category.value,
      originalFileName: file.originalname,
      audioUrl,
      imageUrl,
      audioKey,
      imageKey,
      mimeType: prepared.processedAudio.contentType,
      imageMimeType: prepared.cover.contentType,
      durationSeconds: prepared.processedAudio.durationSeconds,
      sizeBytes: prepared.processedAudio.buffer.byteLength,
      sourceCodec: prepared.processedAudio.sourceCodec,
      sourceContainer: prepared.processedAudio.sourceContainer,
      processingMode: prepared.processedAudio.processingMode,
    });

    return {
      status: "uploaded",
      id: song.id,
      title: song.title,
      artist: song.artist,
      category: song.category,
      originalFileName: song.originalFileName,
      audioUrl: song.audioUrl,
      imageUrl: song.imageUrl,
      audioKey: song.audioKey,
      imageKey: song.imageKey,
      processingMode: song.processingMode,
      sourceCodec: song.sourceCodec,
    };
  } catch (error) {
    await Promise.allSettled([
      audioUrl ? deleteObject(audioKey) : Promise.resolve(),
      imageUrl ? deleteObject(imageKey) : Promise.resolve(),
    ]);

    if (error && typeof error === "object" && error.code === 11000) {
      return {
        status: "skipped",
        reason: "Song with same title and artist already exists in this category.",
        title: prepared.title,
        artist: prepared.artist,
        category: category.value,
        originalFileName: file.originalname,
      };
    }

    throw error;
  } finally {
    if (options.cleanupSource !== false) {
      await cleanupUploadedFile(file.path);
    }
  }
}

async function uploadManySongs(files, categoryInput, options = {}) {
  const results = [];

  for (const file of files) {
    try {
      const result = await uploadSongFile(file, categoryInput, options);
      results.push(result);
    } catch (error) {
      if (options.cleanupSource !== false) {
        await cleanupUploadedFile(file.path);
      }
      results.push({
        status: "failed",
        originalFileName: file.originalname,
        category: `${categoryInput || ""}`.trim().toLowerCase(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function listSongs(options = {}) {
  const limit = Number(options.limit || 100);
  const query = {};

  if (options.category) {
    query.category = options.category;
  }

  return Song.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

async function countSongsByCategory() {
  const rows = await Song.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
  const counts = {};

  for (const row of rows) {
    counts[row._id] = row.count;
  }

  return counts;
}

async function getSongById(songId) {
  return Song.findById(songId).lean();
}

module.exports = {
  countSongsByCategory,
  getSongById,
  listSongs,
  uploadSongFile,
  uploadManySongs,
};
