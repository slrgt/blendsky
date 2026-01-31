# blendsky

A pckt.blog-style UI for **wikis**, **forums**, and your **Bluesky feed** (posts from everyone you follow).

## What’s in it

- **Wiki** — Create and edit pages. Search or create by title. Simple Markdown (headers, bold, links, code). Data is stored in your browser (localStorage).
- **Forum** — New threads, replies, back to list. **Compatible with [standard.site](https://standard.site/) and [atcute](https://tangled.org/mary.my.id/atcute)** (@atcute/standard-site, @atcute/pckt): threads use the same document shape (title, path, description, tags, publishedAt, updatedAt). Export a thread as a standard.site document (JSON) or **import** from an AT URI (`at://…/site.standard.document/…`). Works with pckt.blog, Leaflet, and other atcute-based apps. All stored in localStorage.
- **Bluesky** — **OAuth** (same flow as pckt.blog): enter your handle, sign in on Bluesky, approve access. No app password. Your **timeline** (posts from people you follow) loads here.

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

To use only Wiki and Forum without the server, open `app/index.html` in a browser or serve the `app/` folder. The Bluesky section will show “Connect” but will only work when the server is running and you use the app from the same origin.

## Compatibility with atcute

blendsky is compatible with the **[atcute](https://tangled.org/mary.my.id/atcute)** ecosystem:

- **Forum documents** use the same shape as **site.standard.document** (from [standard.site lexicons](https://tangled.org/standard.site/lexicons)). Exported JSON includes `$type: "site.standard.document"` and the same fields (site, path, title, description, content, textContent, tags, publishedAt, updatedAt) that **@atcute/standard-site** and **@atcute/pckt** expect. You can import documents from atcute-based apps (pckt.blog, Leaflet, etc.) via AT URI and export threads for use there.

- **Server** uses `@atproto/oauth-client-node` and `@atproto/api`; you can swap to **@atcute/oauth-node-client** and **@atcute/client** if you prefer the atcute stack.

## Tech

- **App:** Vanilla HTML/CSS/JS, no build step. Fonts: DM Sans, Fraunces. Design inspired by [pckt.blog](https://pckt.blog).
- **Bluesky:** OAuth (confidential client) via `@atproto/oauth-client-node`; timeline from people you follow via backend API.
