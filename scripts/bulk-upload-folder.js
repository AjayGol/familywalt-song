#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { connectToDatabase } = require("../src/db/connect");
const { ensureCategoryFoldersExist } = require("../src/lib/r2");
const { uploadManySongs } = require("../src/services/songUploadService");

const ALLOWED_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac"]);

function parseArgs(argv) {
  const options = {
    folder: "",
    category: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--folder") {
      options.folder = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (arg === "--category") {
      options.category = argv[index + 1] || "";
      index += 1;
    }
  }

  return options;
}

async function collectAudioFiles(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectAudioFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push({
        path: entryPath,
        originalname: entry.name,
      });
    }
  }

  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.folder) {
    throw new Error("Missing required flag: --folder <folder-path>");
  }

  if (!options.category) {
    throw new Error("Missing required flag: --category <arti|chalis|sundarkand|path|mantra>");
  }

  await connectToDatabase();
  await ensureCategoryFoldersExist();

  const files = await collectAudioFiles(path.resolve(options.folder));

  if (!files.length) {
    throw new Error(`No supported audio files found in ${options.folder}`);
  }

  const results = await uploadManySongs(files, options.category, { cleanupSource: false });
  const summary = {
    total: results.length,
    uploaded: results.filter((result) => result.status === "uploaded").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  };

  process.stdout.write(`${JSON.stringify({ summary, results }, null, 2)}\n`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
