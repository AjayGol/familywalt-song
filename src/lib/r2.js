const { PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getEnv } = require("../config/env");
const { getCategories } = require("../config/categories");

let r2Client = null;
let ensuredFoldersPromise = null;

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const env = getEnv();
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });

  return r2Client;
}

function getPublicUrl(key) {
  return `${getEnv().r2PublicBaseUrl}/${encodeURIComponent(key)}`;
}

async function putObject(options) {
  const env = getEnv();
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: env.r2Bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      ContentDisposition: options.contentType.startsWith("audio/") ? "inline" : undefined,
      CacheControl: options.cacheControl || "public, max-age=31536000, immutable",
    }),
  );

  return getPublicUrl(options.key);
}

async function deleteObject(key) {
  const env = getEnv();
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.r2Bucket,
      Key: key,
    }),
  );
}

async function copyObject(sourceKey, destinationKey) {
  const env = getEnv();
  const client = getR2Client();
  const encodedSource = `${env.r2Bucket}/${sourceKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: env.r2Bucket,
      CopySource: encodedSource,
      Key: destinationKey,
      MetadataDirective: "COPY",
    }),
  );

  return getPublicUrl(destinationKey);
}

async function ensureCategoryFoldersExist() {
  if (ensuredFoldersPromise) {
    return ensuredFoldersPromise;
  }

  ensuredFoldersPromise = (async () => {
    const uploads = [];

    for (const category of getCategories()) {
      uploads.push(
        putObject({
          key: `songs/${category.rootFolder}/${category.imageFolder}/.keep`,
          body: Buffer.alloc(0),
          contentType: "application/octet-stream",
          cacheControl: "no-cache",
        }),
      );
      uploads.push(
        putObject({
          key: `songs/${category.rootFolder}/${category.songFolder}/.keep`,
          body: Buffer.alloc(0),
          contentType: "application/octet-stream",
          cacheControl: "no-cache",
        }),
      );
    }

    await Promise.all(uploads);
  })();

  return ensuredFoldersPromise;
}

module.exports = {
  copyObject,
  getPublicUrl,
  putObject,
  deleteObject,
  ensureCategoryFoldersExist,
};
