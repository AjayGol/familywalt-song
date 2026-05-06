const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const { getCategoryConfig } = require("../config/categories");
const { Song } = require("../models/song");
const { prepareUploadAssets } = require("../lib/media");
const { copyObject, deleteObject, ensureCategoryFoldersExist, getPublicUrl, putObject } = require("../lib/r2");

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

async function updateSongMetadata(songId, input) {
  if (!mongoose.isValidObjectId(songId)) {
    throw new Error("Invalid song id.");
  }

  const song = await Song.findById(songId);

  if (!song) {
    throw new Error("Song not found.");
  }

  const title = `${input.title || ""}`.trim();
  const artist = `${input.artist || ""}`.trim();
  const category = getCategoryConfig(input.category);

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!artist) {
    throw new Error("Artist is required.");
  }

  if (!category) {
    throw new Error("Invalid category.");
  }

  const normalizedTitle = normalizeText(title);
  const normalizedArtist = normalizeText(artist);
  const oldCategory = getCategoryConfig(song.category);
  const categoryChanged = song.category !== category.value;
  const duplicate = await Song.findOne({
    _id: { $ne: song._id },
    category: category.value,
    normalizedTitle,
    normalizedArtist,
  }).lean();

  if (duplicate) {
    throw new Error("Another song with the same title and artist already exists in this category.");
  }

  let nextAudioKey = song.audioKey;
  let nextImageKey = song.imageKey;
  let nextAudioUrl = song.audioUrl;
  let nextImageUrl = song.imageUrl;

  if (categoryChanged) {
    await ensureCategoryFoldersExist();

    const audioExtension = path.extname(song.audioKey);
    const imageExtension = path.extname(song.imageKey);
    const fileId = randomUUID();

    nextAudioKey = `songs/${category.rootFolder}/${category.songFolder}/${fileId}${audioExtension}`;
    nextImageKey = `songs/${category.rootFolder}/${category.imageFolder}/${fileId}${imageExtension}`;

    try {
      [nextAudioUrl, nextImageUrl] = await Promise.all([
        copyObject(song.audioKey, nextAudioKey),
        copyObject(song.imageKey, nextImageKey),
      ]);
    } catch (error) {
      await Promise.allSettled([
        nextAudioKey !== song.audioKey ? deleteObject(nextAudioKey) : Promise.resolve(),
        nextImageKey !== song.imageKey ? deleteObject(nextImageKey) : Promise.resolve(),
      ]);
      throw error;
    }
  } else {
    nextAudioUrl = getPublicUrl(song.audioKey);
    nextImageUrl = getPublicUrl(song.imageKey);
  }

  const previousAudioKey = song.audioKey;
  const previousImageKey = song.imageKey;

  song.title = title;
  song.artist = artist;
  song.normalizedTitle = normalizedTitle;
  song.normalizedArtist = normalizedArtist;
  song.category = category.value;
  song.audioKey = nextAudioKey;
  song.imageKey = nextImageKey;
  song.audioUrl = nextAudioUrl;
  song.imageUrl = nextImageUrl;

  try {
    await song.save();
  } catch (error) {
    if (categoryChanged) {
      await Promise.allSettled([deleteObject(nextAudioKey), deleteObject(nextImageKey)]);
    }
    throw error;
  }

  if (categoryChanged) {
    await Promise.allSettled([deleteObject(previousAudioKey), deleteObject(previousImageKey)]);
  }

  return song.toObject();
}

module.exports = {
  countSongsByCategory,
  getSongById,
  listSongs,
  updateSongMetadata,
  uploadSongFile,
  uploadManySongs,
};
