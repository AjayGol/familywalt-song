const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const mongoose = require("mongoose");

// Reuse low-level lib helpers (read-only – no modifications to those files)
const { prepareUploadAssets } = require("../../lib/media");
const { putObject, deleteObject } = require("../../lib/r2");
const { generateHindiTitle } = require("../../lib/titleLocalization");
const { DurgaChalisa } = require("../models/durgaChalisa");
const { ShaniChalisa } = require("../models/shaniChalisa");

/** R2 root folders per chalisa type */
const CHALISA_FOLDERS = {
  durga: "chalisa/durga",
  shani: "chalisa/shani",
};

function normalizeText(value) {
  return `${value || ""}`.trim().toLowerCase();
}

async function cleanupFile(filePath) {
  if (!filePath) return;
  await fs.rm(filePath, { force: true });
}

/**
 * Resolve the correct Mongoose model for the given chalisa type.
 * @param {"durga"|"shani"} type
 */
function getModel(type) {
  if (type === "durga") return DurgaChalisa;
  if (type === "shani") return ShaniChalisa;
  throw new Error(`Unknown chalisa type: ${type}`);
}

/**
 * Upload a single audio file into the specified chalisa collection.
 * @param {import("multer").File} file
 * @param {"durga"|"shani"} type
 */
async function uploadChalisaSong(file, type) {
  const Model = getModel(type);
  const folder = CHALISA_FOLDERS[type];

  const prepared = await prepareUploadAssets(file.path, file.originalname);
  const normalizedTitle = normalizeText(prepared.title);
  const normalizedArtist = normalizeText(prepared.artist);

  // Skip duplicates (same title + artist)
  const existing = await Model.findOne({ normalizedTitle, normalizedArtist }).lean();

  if (existing) {
    await cleanupFile(file.path);
    return {
      status: "skipped",
      reason: "A song with the same title and artist already exists.",
      title: prepared.title,
      artist: prepared.artist,
      originalFileName: file.originalname,
    };
  }

  const songId = randomUUID();
  const audioKey = `${folder}/audio/${songId}${prepared.processedAudio.extension}`;
  const imageKey = `${folder}/image/${songId}${prepared.cover.extension}`;

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

    const song = await Model.create({
      title: prepared.title,
      titleHindi: generateHindiTitle(prepared.title),
      artist: prepared.artist,
      normalizedTitle,
      normalizedArtist,
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
      id: String(song._id),
      title: song.title,
      titleHindi: song.titleHindi,
      artist: song.artist,
      originalFileName: song.originalFileName,
      audioUrl: song.audioUrl,
      imageUrl: song.imageUrl,
      durationSeconds: song.durationSeconds,
    };
  } catch (error) {
    await Promise.allSettled([
      audioUrl ? deleteObject(audioKey) : Promise.resolve(),
      imageUrl ? deleteObject(imageKey) : Promise.resolve(),
    ]);

    if (error && typeof error === "object" && error.code === 11000) {
      return {
        status: "skipped",
        reason: "A song with the same title and artist already exists.",
        title: prepared.title,
        artist: prepared.artist,
        originalFileName: file.originalname,
      };
    }

    throw error;
  } finally {
    await cleanupFile(file.path);
  }
}

/**
 * List all songs for the given chalisa type, newest first.
 * @param {"durga"|"shani"} type
 */
async function listChalisaSongs(type) {
  const Model = getModel(type);
  return Model.find({}).sort({ createdAt: -1 }).lean();
}

/**
 * Get a single chalisa song by ID.
 * @param {"durga"|"shani"} type
 * @param {string} id
 */
async function getChalisaSongById(type, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid song id.");
  }

  const Model = getModel(type);
  return Model.findById(id).lean();
}

/**
 * Delete a chalisa song by ID (removes DB doc + R2 files).
 * @param {"durga"|"shani"} type
 * @param {string} id
 */
async function deleteChalisaSong(type, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid song id.");
  }

  const Model = getModel(type);
  const song = await Model.findById(id);

  if (!song) {
    throw new Error("Song not found.");
  }

  const { audioKey, imageKey } = song;

  await song.deleteOne();
  await Promise.allSettled([deleteObject(audioKey), deleteObject(imageKey)]);

  return {
    id: String(song._id),
    title: song.title,
    artist: song.artist,
  };
}

module.exports = {
  uploadChalisaSong,
  listChalisaSongs,
  getChalisaSongById,
  deleteChalisaSong,
};
