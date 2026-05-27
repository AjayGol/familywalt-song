const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const mongoose = require("mongoose");
const { getCategoryConfig } = require("../config/categories");
const { prepareAlbumCoverAsset } = require("../lib/media");
const { deleteObject, ensureCategoryFoldersExist, putObject } = require("../lib/r2");
const { remember, invalidateSongQueryCache } = require("../lib/songQueryCache");
const { Album } = require("../models/album");
const { Song } = require("../models/song");

function normalizeText(value) {
  return `${value || ""}`.trim().toLowerCase();
}

async function cleanupUploadedFile(filePath) {
  if (!filePath) {
    return;
  }

  await fs.rm(filePath, { force: true });
}

function validateAlbumInput(name, categoryInput) {
  const category = getCategoryConfig(categoryInput);
  const trimmedName = `${name || ""}`.trim();

  if (!category) {
    throw new Error("Invalid category.");
  }

  if (!trimmedName) {
    throw new Error("Album name is required.");
  }

  return {
    category,
    trimmedName,
    normalizedName: normalizeText(trimmedName),
  };
}

async function listAlbums(options = {}) {
  const limit = Number(options.limit || 100);
  const category = options.category || null;

  return remember(
    "albums:list",
    { category, limit },
    async () => {
      const query = {};

      if (category) {
        query.category = category;
      }

      return Album.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    },
    { ttlMs: 30 * 1000 },
  );
}

async function getAlbumById(albumId) {
  if (!mongoose.isValidObjectId(albumId)) {
    throw new Error("Invalid album id.");
  }

  return remember(
    "albums:detail",
    { albumId },
    () => Album.findById(albumId).populate({ path: "songIds", options: { sort: { createdAt: -1 } } }).lean(),
    { ttlMs: 30 * 1000 },
  );
}

async function createAlbum(file, input) {
  if (!file) {
    throw new Error("imageFile is required.");
  }

  const { category, trimmedName, normalizedName } = validateAlbumInput(input?.name, input?.category);

  await ensureCategoryFoldersExist();

  const duplicate = await Album.findOne({
    category: category.value,
    normalizedName,
  }).lean();

  if (duplicate) {
    throw new Error("Another album with the same name already exists in this category.");
  }

  const preparedCover = await prepareAlbumCoverAsset(file.path);
  const imageKey = `songs/album/${randomUUID()}${preparedCover.extension}`;
  let imageUrl = null;

  try {
    imageUrl = await putObject({
      key: imageKey,
      body: preparedCover.buffer,
      contentType: preparedCover.contentType,
    });

    const album = await Album.create({
      name: trimmedName,
      normalizedName,
      category: category.value,
      imageUrl,
      imageKey,
      songIds: [],
    });

    invalidateSongQueryCache();
    return album.toObject();
  } catch (error) {
    if (imageUrl) {
      await Promise.allSettled([deleteObject(imageKey)]);
    }

    if (error && typeof error === "object" && error.code === 11000) {
      throw new Error("Another album with the same name already exists in this category.");
    }

    throw error;
  } finally {
    await cleanupUploadedFile(file.path);
  }
}

async function renameAlbum(albumId, input) {
  if (!mongoose.isValidObjectId(albumId)) {
    throw new Error("Invalid album id.");
  }

  const album = await Album.findById(albumId);

  if (!album) {
    throw new Error("Album not found.");
  }

  const { category, trimmedName, normalizedName } = validateAlbumInput(input?.name, album.category);
  const duplicate = await Album.findOne({
    _id: { $ne: album._id },
    category: category.value,
    normalizedName,
  }).lean();

  if (duplicate) {
    throw new Error("Another album with the same name already exists in this category.");
  }

  album.name = trimmedName;
  album.normalizedName = normalizedName;
  await album.save();
  invalidateSongQueryCache();

  return getAlbumById(album.id);
}

async function deleteAlbum(albumId) {
  if (!mongoose.isValidObjectId(albumId)) {
    throw new Error("Invalid album id.");
  }

  const album = await Album.findById(albumId);

  if (!album) {
    throw new Error("Album not found.");
  }

  const imageKey = album.imageKey;

  await album.deleteOne();
  await Promise.allSettled([deleteObject(imageKey)]);
  invalidateSongQueryCache();

  return {
    id: String(album._id),
    name: album.name,
    category: album.category,
  };
}

async function addSongToAlbum(albumId, songId) {
  if (!mongoose.isValidObjectId(albumId)) {
    throw new Error("Invalid album id.");
  }

  if (!mongoose.isValidObjectId(songId)) {
    throw new Error("Invalid song id.");
  }

  const [album, song] = await Promise.all([Album.findById(albumId), Song.findById(songId)]);

  if (!album) {
    throw new Error("Album not found.");
  }

  if (!song) {
    throw new Error("Song not found.");
  }

  const alreadyExists = album.songIds.some((id) => String(id) === String(song._id));

  if (!alreadyExists) {
    album.songIds.push(song._id);
    await album.save();
    invalidateSongQueryCache();
  }

  return getAlbumById(album.id);
}

async function removeSongFromAlbum(albumId, songId) {
  if (!mongoose.isValidObjectId(albumId)) {
    throw new Error("Invalid album id.");
  }

  if (!mongoose.isValidObjectId(songId)) {
    throw new Error("Invalid song id.");
  }

  const album = await Album.findById(albumId);

  if (!album) {
    throw new Error("Album not found.");
  }

  album.songIds = album.songIds.filter((id) => String(id) !== String(songId));
  await album.save();
  invalidateSongQueryCache();

  return getAlbumById(album.id);
}

module.exports = {
  addSongToAlbum,
  createAlbum,
  deleteAlbum,
  getAlbumById,
  listAlbums,
  removeSongFromAlbum,
  renameAlbum,
};
