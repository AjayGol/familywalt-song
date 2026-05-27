const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const sharp = require("sharp");
const { getEnv } = require("../config/env");

const execFileAsync = promisify(execFile);

function parseNumber(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAudioStream(payload) {
  return payload.streams?.find((stream) => stream.codec_type === "audio") ?? null;
}

function getCoverStream(payload) {
  return payload.streams?.find((stream) => stream.codec_type === "video") ?? null;
}

function getDurationSeconds(format) {
  const duration = parseNumber(format.duration);

  if (duration === null || duration <= 0) {
    return null;
  }

  return Math.round(duration);
}

function getContainerNames(format) {
  return `${format.format_name || ""}`
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

function getSourceBitrate(audioStream, format) {
  return parseNumber(audioStream.bit_rate) ?? parseNumber(format.bit_rate);
}

function deriveAacBitrate(sourceBitrate) {
  if (!sourceBitrate) {
    return "256k";
  }

  const kbps = Math.round(sourceBitrate / 1000);
  const normalized = Math.round(kbps / 16) * 16;
  const clamped = Math.min(320, Math.max(128, normalized));
  return `${clamped}k`;
}

function getAudioOutputPlan(payload) {
  const format = payload.format ?? {};
  const audioStream = getAudioStream(payload);

  if (!audioStream?.codec_name) {
    throw new Error("No readable audio stream was found in the uploaded file.");
  }

  const codec = audioStream.codec_name.toLowerCase();
  const sourceContainer = getContainerNames(format);
  const sourceBitrate = getSourceBitrate(audioStream, format);

  if (codec === "mp3") {
    return {
      sourceCodec: codec,
      sourceContainer,
      durationSeconds: getDurationSeconds(format),
      processingMode: "copy-mp3",
      extension: ".mp3",
      contentType: "audio/mpeg",
      ffmpegArgs: ["-c:a", "copy"],
    };
  }

  if (codec === "aac") {
    return {
      sourceCodec: codec,
      sourceContainer,
      durationSeconds: getDurationSeconds(format),
      processingMode: "remux-aac",
      extension: ".m4a",
      contentType: "audio/mp4",
      ffmpegArgs: ["-c:a", "copy", "-movflags", "+faststart"],
    };
  }

  return {
    sourceCodec: codec,
    sourceContainer,
    durationSeconds: getDurationSeconds(format),
    processingMode: "transcode-aac",
    extension: ".m4a",
    contentType: "audio/mp4",
    ffmpegArgs: ["-c:a", "aac", "-b:a", deriveAacBitrate(sourceBitrate), "-movflags", "+faststart"],
  };
}

function getCoverOutputPlan(payload) {
  const coverStream = getCoverStream(payload);

  if (!coverStream?.codec_name) {
    return null;
  }

  const codec = coverStream.codec_name.toLowerCase();

  if (codec === "mjpeg" || codec === "jpeg") {
    return {
      extension: ".jpg",
      contentType: "image/jpeg",
      ffmpegArgs: ["-map", "0:v:0", "-frames:v", "1", "-c:v", "copy"],
    };
  }

  if (codec === "png") {
    return {
      extension: ".png",
      contentType: "image/png",
      ffmpegArgs: ["-map", "0:v:0", "-frames:v", "1", "-c:v", "copy"],
    };
  }

  if (codec === "webp") {
    return {
      extension: ".webp",
      contentType: "image/webp",
      ffmpegArgs: ["-map", "0:v:0", "-frames:v", "1", "-c:v", "copy"],
    };
  }

  return {
    extension: ".jpg",
    contentType: "image/jpeg",
    ffmpegArgs: ["-map", "0:v:0", "-frames:v", "1", "-c:v", "mjpeg"],
  };
}

function getTagValue(tags, name) {
  if (!tags || typeof tags !== "object") {
    return "";
  }

  const entry = Object.entries(tags).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return typeof entry?.[1] === "string" ? entry[1].trim() : "";
}

function sanitizeFileStem(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/_spotdown\.org$/iu, "")
    .replace(/[_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function probeMedia(inputPath) {
  const env = getEnv();

  try {
    const { stdout } = await execFileAsync(env.ffprobePath, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ]);

    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("ffprobe is not available on the server.");
    }

    throw error instanceof Error ? error : new Error("Unable to inspect uploaded audio.");
  }
}

async function runFfmpeg(inputPath, outputPath, ffmpegArgs) {
  const env = getEnv();

  try {
    await execFileAsync(env.ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      ...ffmpegArgs,
      outputPath,
    ]);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("ffmpeg is not available on the server.");
    }

    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr).trim() : "";

    throw new Error(stderr || "Unable to prepare the uploaded song.");
  }
}

async function prepareUploadAssets(filePath, originalFileName) {
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "uploadback-media-"));

  try {
    const probePayload = await probeMedia(filePath);
    const format = probePayload.format ?? {};
    const audioPlan = getAudioOutputPlan(probePayload);
    const coverPlan = getCoverOutputPlan(probePayload);

    if (!coverPlan) {
      throw new Error("No embedded cover art was found in the song file.");
    }

    const outputAudioPath = path.join(workingDir, `audio-${randomUUID()}${audioPlan.extension}`);
    const outputCoverPath = path.join(workingDir, `cover-${randomUUID()}${coverPlan.extension}`);

    await runFfmpeg(filePath, outputAudioPath, [
      "-map",
      "0:a:0",
      "-map_metadata",
      "0",
      "-vn",
      ...audioPlan.ffmpegArgs,
    ]);

    await runFfmpeg(filePath, outputCoverPath, coverPlan.ffmpegArgs);

    const title = getTagValue(format.tags, "title") || sanitizeFileStem(originalFileName);
    const artist = getTagValue(format.tags, "artist") || "Unknown Artist";

    return {
      title,
      artist,
      processedAudio: {
        buffer: await fs.readFile(outputAudioPath),
        extension: audioPlan.extension,
        contentType: audioPlan.contentType,
        durationSeconds: audioPlan.durationSeconds,
        sourceCodec: audioPlan.sourceCodec,
        sourceContainer: audioPlan.sourceContainer,
        processingMode: audioPlan.processingMode,
      },
      cover: {
        buffer: await fs.readFile(outputCoverPath),
        extension: coverPlan.extension,
        contentType: coverPlan.contentType,
      },
    };
  } finally {
    await fs.rm(workingDir, { recursive: true, force: true });
  }
}

async function prepareAlbumCoverAsset(filePath) {
  try {
    const image = sharp(filePath, { failOn: "warning" }).rotate().resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    });

    return {
      buffer: await image.webp({ quality: 82 }).toBuffer(),
      extension: ".webp",
      contentType: "image/webp",
    };
  } catch (error) {
    throw error instanceof Error ? new Error("Unable to prepare the album cover image.") : error;
  }
}

module.exports = {
  prepareAlbumCoverAsset,
  prepareUploadAssets,
};
