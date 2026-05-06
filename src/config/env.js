const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getEnv() {
  return {
    port: Number(process.env.PORT || 4000),
    mongoUri: requireEnv("MONGODB_URI"),
    mongoDbName: process.env.MONGODB_DB_NAME || "uploadback",
    r2AccountId: requireEnv("R2_ACCOUNT_ID"),
    r2AccessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    r2Bucket: requireEnv("R2_BUCKET"),
    r2PublicBaseUrl: requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/u, ""),
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  };
}

module.exports = {
  getEnv,
  requireEnv,
};
