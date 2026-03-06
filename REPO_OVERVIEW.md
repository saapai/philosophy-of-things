# Polished — Philosophy of Things

A blogging platform with an integrated Image Studio for creating and curating visual content alongside writing.

## Tech Stack
- **Backend**: Node.js + Express, sql.js (SQLite in-memory with file persistence)
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Image Processing**: Python (OpenCV + pykuwahara) for painterly filters; OpenAI API for AI generation
- **Deployment**: Vercel (serverless)

## Project Structure
```
server.js              — Express app entry point
db/init.js             — sql.js database setup, query helpers (query, queryOne, execute)
db/polished.db         — SQLite database file
routes/posts.js        — CRUD for blog posts
routes/images.js       — Image upload, AI generation, painterly filter endpoints
scripts/painterly.py   — Python CLI: oil/icm/hybrid filter styles
public/
  index.html           — Homepage with post feed
  draft.html           — Draft editor + Image Studio (split pane)
  post.html            — Single post view
  js/draft.js          — Draft page client logic (upload, generate, filter, save)
  js/post.js           — Post page client logic
  css/style.css        — All styles (cream/ink/neon-red/neon-blue palette)
  favicon.svg          — Tri-color pixelated favicon
uploads/               — Uploaded and generated images
requirements.txt       — Python deps (opencv-contrib-python, pykuwahara, numpy)
vercel.json            — Vercel deployment config
```

## Database Schema (sql.js)
- **posts**: id, title, body, cover_image, status (draft/published), created_at, updated_at
- **images**: id, post_id (FK), file_path, prompt, parent_image_id (FK self-ref), mode (initial/blend/iterate), created_at

## API Routes
- `POST /api/posts` — Create post
- `GET /api/posts/:id` — Get post
- `PUT /api/posts/:id` — Update post
- `DELETE /api/posts/:id` — Delete post
- `POST /api/images/upload` — Upload image file
- `POST /api/images/generate` — AI image generation (OpenAI)
- `POST /api/images/filter` — Apply painterly filter (oil/icm/hybrid)
- `GET /api/images/:postId` — List images for a post

## Image Studio Features
- Drag-and-drop image upload
- AI image generation with style prefix (oil painting aesthetic)
- **Painterly filters**: Oil Painting, Dreamy ICM, Hybrid — processed via Python/OpenCV
- Gallery strip with image selection
- Set any image as cover

## Design System
- Colors: cream (#F5F4EF), ink (#1A1814), neon-red (#E8222C), neon-blue (#1B4DFF)
- Fonts: Cormorant Garamond (serif), Inter (body), JetBrains Mono (mono), Silkscreen (pixel)
- Ruled-paper background lines, subtle neon paint splatter overlays

## Dev Notes
- Filtered images stored with `mode='initial'` and `prompt='filter:<style>'` to avoid DB schema migration (CHECK constraint on mode column)
- Python script called synchronously via `execFileSync` with 30s timeout
- No auth — single-user local blog
