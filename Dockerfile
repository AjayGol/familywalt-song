FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=4000 \
    FFMPEG_PATH=ffmpeg \
    FFPROBE_PATH=ffprobe

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const port = process.env.PORT || 4000; fetch(`http://127.0.0.1:${port}/api/health`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));"

CMD ["dumb-init", "node", "src/server.js"]
