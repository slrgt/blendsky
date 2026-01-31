# blendsky

A forum for **Blender users sharing JSON geometry node setups.** **Wiki**, **Forum**, and your **Bluesky feed** in one place.

## What’s in it

- **Wiki** — Document your geometry node setups. Create and edit pages, search or create by title. Simple Markdown (headers, bold, links, code, images). Data is stored in your browser (localStorage). Sync to Bluesky; remix to fork.
- **Forum** — Share JSON geometry node setups, new threads, replies, images. Export a thread as a document (JSON) or **import** from an AT URI (`at://…/app.blendsky.document/…`). All stored in localStorage; sync to Bluesky with #blendsky-forum.
- **Bluesky** — OAuth or app password: enter your handle, connect. Your **timeline** (posts from people you follow) loads on the homepage when logged in.

## Lexicon (AT Protocol)

blendsky uses a single document type for both wiki pages and forum threads:

- **NSID:** `app.blendsky.document`
- **Fields:** `$type`, `kind` (wiki | forum), `site`, `path`, `title`, `description`, `textContent`, `tags`, `publishedAt`, `updatedAt`, `content`; optional `forkOf` (wiki remix), `bskyPostRef` (forum).
- **Discovery:** Documents are discoverable by collection on the AT Protocol; Constellation can index by `app.blendsky.document` and `.site` (origin).

## Run with OAuth (recommended)

Bluesky uses OAuth; the app needs the backend server so Bluesky can redirect back after login.

1. **Server (from repo root):**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env: set BASE_URL (e.g. http://localhost:3000) and BLUESKY_OAUTH_PRIVATE_KEY (ES256 JWK from https://jwkset.com/generate).
   npm install
   npm start
   ```
2. Open **http://localhost:3000** (or your `BASE_URL`). Use **Bluesky** → enter handle → “Connect with Bluesky” → sign in on Bluesky and approve.

For **local dev**, `BASE_URL=http://localhost:3000` is fine. For **production**, use your public HTTPS URL and ensure Bluesky can reach `/oauth/client-metadata.json` and `/oauth/jwks.json`.

## Run app only (no Bluesky OAuth)

To use only Wiki and Forum without the server, open `app/index.html` in a browser or serve the `app/` folder. The Bluesky section will show “Connect” but will only work when the server is running and you use the app from the same origin. You can use an **app password** (Bluesky tab) for serverless use on e.g. GitHub Pages.

## Tech

- **App:** Vanilla HTML/CSS/JS, no build step. Fonts: DM Sans, Fraunces.
- **Bluesky:** OAuth (confidential client) via `@atproto/oauth-client-node`; timeline from people you follow via backend API.
