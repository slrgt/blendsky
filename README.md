# blendsky

Wikis, forums, and your Bluesky feed in one place. pckt.blog-style UI and [standard.site](https://standard.site/)–compatible forum. **Runs fully on GitHub Pages with no backend** — Bluesky uses an app password and talks to the AT Protocol from the browser.

- **App:** `app/` — static HTML/CSS/JS (Wiki, Forum, Bluesky). Deploy `docs/` to GitHub Pages; everything works there (Wiki, Forum, Bluesky feed, forum import from AT URI).
- **Server:** `server/` — optional Node/Express OAuth backend. Use it if you prefer OAuth over app password; set `apiBase` in `config.json` to your server URL. Without a server, the app uses app password and works entirely in the browser.
- **Deploy to GitHub Pages:** See [GITHUB_PAGES.md](GITHUB_PAGES.md). No backend needed: Bluesky uses app password; forum import fetches AT records from the browser.
