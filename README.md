# familywalt-song

Song upload backend with:

- MongoDB
- Cloudflare R2
- ffmpeg/ffprobe audio processing
- bulk upload UI
- simple player page
- mobile category APIs for Android

## Setup

1. Clone the repo.
2. Create a `.env` file in the project root.
3. Copy values from `.env.example`.
4. Fill in your real MongoDB and R2 credentials.
5. Install dependencies:

```bash
npm install
```

6. Start the server:

```bash
npm start
```

App URLs:

- `http://localhost:4000/`
- `http://localhost:4000/upload.html`
- `http://localhost:4000/player.html`

## Environment Variables

Create a local `.env` file with:

```env
PORT=4000
MONGODB_URI=
MONGODB_DB_NAME=uploadback
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

## Upload Flow

- Choose category
- Upload single file, multiple files, or full folder
- Audio metadata is read with `ffprobe`
- Cover image is extracted with `ffmpeg`
- Audio and image are uploaded to Cloudflare R2
- Song data is stored in MongoDB

R2 folder structure:

- `songs/arti/imagearti`
- `songs/arti/songarti`
- `songs/chalis/imagechalis`
- `songs/chalis/songchalis`
- `songs/sundarkand/imagesundarkand`
- `songs/sundarkand/songsundarkand`
- `songs/path/imagepath`
- `songs/path/songpath`
- `songs/mantra/imagemantra`
- `songs/mantra/songmantra`

## Mobile APIs

Get all categories:

```http
GET /api/mobile/categories
```

Get songs by category:

```http
GET /api/mobile/categories/aarti/songs
GET /api/mobile/categories/chalisa/songs
GET /api/mobile/categories/sundarkand/songs
GET /api/mobile/categories/path/songs
GET /api/mobile/categories/mantra/songs
```

Get one song:

```http
GET /api/mobile/songs/:songId
```

## Render Deployment

Create a new Web Service on Render:

- Build Command: `npm install`
- Start Command: `npm start`

Add these environment variables in Render:

- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `FFMPEG_PATH`
- `FFPROBE_PATH`

Important:

- Do not commit the real `.env` file
- Keep secrets only in local `.env` or Render environment settings
- Rotate any credentials that were previously shared

## Docker Deployment

Build the production image:

```bash
docker build -t familywalt-song .
```

Run the container with your local `.env` file:

```bash
docker run --env-file .env -p 4000:4000 familywalt-song
```

Or run with Docker Compose:

```bash
docker compose up --build
```

The container includes `ffmpeg` and `ffprobe`, so the default `FFMPEG_PATH=ffmpeg` and `FFPROBE_PATH=ffprobe` values work as-is. The image does not copy `.env`; inject secrets through your deployment platform, `--env-file`, or Compose.

## GitHub Actions Deployment

The repository includes `.github/workflows/deploy.yml` for deploying to a Docker Compose server. On every push to `main` or manual workflow run, GitHub Actions:

- syncs the repository to the server
- creates/updates the server `.env` file from GitHub Secrets
- runs `docker compose up -d --build`

Add these repository secrets in GitHub:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional, defaults to `22`)
- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `FFMPEG_PATH`
- `FFPROBE_PATH`

Optional repository variable:

- `APP_DIR` (defaults to `/opt/familywalt-song`)

The deploy user must be able to write to `APP_DIR` and run Docker Compose on the server. After this is configured, update env values in GitHub Secrets instead of editing `.env` manually over SSH.
