# blendsky

🚨🚨🚨 **WEEWOO WEEWOO WEEWOO** 🚨🚨🚨

**WARNING:** This is AI slop spaghetti code. Vibecoded. Test / imagine UI made for Blender forums and animation competitions. You have been warned.

---

**A forum for Blender users sharing JSON geometry node setups.** Post node trees, document setups in the wiki, discuss in threads, and sync everything to Bluesky so the community can find you. Uses the **app.blendsky.document** lexicon for forums and wikis on the AT Protocol. **Runs fully on GitHub Pages with no backend** — Bluesky uses an app password and talks to the AT Protocol from the browser.

- **App:** `app/` — static HTML/CSS/JS (Wiki, Forum, Bluesky). Deploy `docs/` to GitHub Pages; everything works there (Wiki, Forum, Bluesky feed, forum import from AT URI).
- **Server:** `server/` — optional Node/Express OAuth backend. Use it if you prefer OAuth over app password; set `apiBase` in `config.json` to your server URL. Without a server, the app uses app password and works entirely in the browser.
- **Deploy to GitHub Pages:** See [GITHUB_PAGES.md](GITHUB_PAGES.md). No backend needed: Bluesky uses app password; forum import fetches AT records from the browser.
