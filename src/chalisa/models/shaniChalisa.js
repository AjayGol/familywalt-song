const mongoose = require("mongoose");

const shaniChalisaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleHindi: {
      type: String,
      default: "",
      trim: true,
    },
    artist: {
      type: String,
      required: true,
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

shaniChalisaSchema.index(
  { normalizedTitle: 1, normalizedArtist: 1 },
  { unique: true, name: "uniq_shani_chalisa_song" },
);

const ShaniChalisa =
  mongoose.models.ShaniChalisa || mongoose.model("ShaniChalisa", shaniChalisaSchema, "shanichalisa");

module.exports = { ShaniChalisa };
