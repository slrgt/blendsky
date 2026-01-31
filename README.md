# blendsky

Wikis, forums, and your Bluesky feed in one place. pckt.blog-style UI with OAuth and [standard.site](https://standard.site/)–compatible forum.

- **App:** `app/` — static HTML/CSS/JS (Wiki, Forum, Bluesky section).
- **Server:** `server/` — Node/Express OAuth backend for Bluesky and AT record fetch (required for Bluesky feed and forum import from AT URI).
- **Deploy to GitHub Pages:** See [GITHUB_PAGES.md](GITHUB_PAGES.md). The `docs/` folder is the built app for Pages; Wiki and Forum work there; Bluesky requires the server elsewhere.

Quick start with Bluesky: `cd server && cp .env.example .env` (set `BASE_URL`, `BLUESKY_OAUTH_PRIVATE_KEY`), `npm install && npm start`, then open the URL in a browser.
