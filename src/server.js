const express = require("express");
const path = require("node:path");
const { getEnv } = require("./config/env");
const { connectToDatabase } = require("./db/connect");
const { ensureCategoryFoldersExist } = require("./lib/r2");
const { router } = require("./routes/uploadRoutes");

async function startServer() {
  const env = getEnv();
  const app = express();
  const publicDir = path.join(process.cwd(), "public");

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", router);
  app.get("/song-media-cache-sw.js", (request, response) => {
    response.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.set("Service-Worker-Allowed", "/");
    response.sendFile(path.join(publicDir, "song-media-cache-sw.js"));
  });
  app.use(
    express.static(publicDir, {
      maxAge: "1h",
      etag: true,
      lastModified: true,
    }),
  );

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  });

  await connectToDatabase();
  await ensureCategoryFoldersExist();

  app.listen(env.port, () => {
    process.stdout.write(`Upload backend running at http://localhost:${env.port}\n`);
  });
}

startServer().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
