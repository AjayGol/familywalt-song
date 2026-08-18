const mongoose = require("mongoose");

const albumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["arti", "chalis", "sundarkand", "path", "mantra"],
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageKey: {
      type: String,
      required: true,
    },
    songIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

albumSchema.index({ category: 1, normalizedName: 1 }, { unique: true, name: "uniq_album_per_category" });

const Album = mongoose.models.Album || mongoose.model("Album", albumSchema);

module.exports = {
  Album,
};
