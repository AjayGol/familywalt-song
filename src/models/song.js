const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
    },
    titleHindi: {
      type: String,
      default: "",
      trim: true,
    },
    normalizedTitle: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedArtist: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["arti", "chalis", "sundarkand", "path", "mantra"],
    },
    originalFileName: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    audioKey: {
      type: String,
      required: true,
    },
    imageKey: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    imageMimeType: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: null,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    sourceCodec: {
      type: String,
      default: null,
    },
    sourceContainer: {
      type: [String],
      default: [],
    },
    processingMode: {
      type: String,
      required: true,
      enum: ["copy-mp3", "remux-aac", "transcode-aac"],
    },
  },
  {
    timestamps: true,
  },
);

songSchema.index(
  { category: 1, normalizedTitle: 1, normalizedArtist: 1 },
  { unique: true, name: "uniq_song_per_category" },
);

const Song = mongoose.models.Song || mongoose.model("Song", songSchema);

module.exports = {
  Song,
};
