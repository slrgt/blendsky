# Deploy blendsky to GitHub Pages

## 1. Enable GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. **Build and deployment**
   - **Source:** Deploy from a branch  
   - **Branch:** `main` (or your default branch)  
   - **Folder:** `/docs`  
4. Save.

Your site will be at **`https://<username>.github.io/<repo>/`** (e.g. `https://username.github.io/blendsky/`).

## 2. What gets deployed

- The **`docs/`** folder contains the blendsky app (HTML, CSS, JS) and is served as the site root.
- **`.nojekyll`** in `docs/` tells GitHub Pages to serve files as-is (no Jekyll).
- When you change files in **`app/`**, either:
  - **Option A:** Run the sync workflow — on push to `main` with changes under `app/`, the **Sync docs for GitHub Pages** workflow copies `app/` → `docs/` and commits. No manual copy needed.
  - **Option B:** Manually copy before pushing:
    ```bash
    cp app/index.html app/app.js app/standard-site.js app/styles.css docs/
    ```

## 3. What works on GitHub Pages

Everything works on GitHub Pages with **no backend**. Data and auth use the browser and the AT Protocol.

- **Wiki** and **Forum** — data is stored in the browser (localStorage). Forum threads can be exported/imported as AT Protocol records (e.g. `site.standard.document`).
- **Bluesky** — with the default config (no `apiBase`), use your Bluesky handle and an [app password](https://bsky.app/settings/app-passwords). The app talks to the AT Protocol (your PDS) directly from the browser. No server is required.

### Optional: OAuth via your own server

If you prefer **OAuth** ("Connect with Bluesky") instead of app passwords, you can run the optional Node server elsewhere and point the app at it:

1. Deploy the **server** (in `server/`) to a host that runs Node (e.g. [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io)). Set `BASE_URL` to that server URL and configure `BLUESKY_OAUTH_PRIVATE_KEY`.
2. In **`docs/config.json`** (or **`app/config.json`** before the next sync), set **`apiBase`** to that server URL:
   ```json
   { "apiBase": "https://your-server.railway.app" }
   ```
3. Push. The app will use "Connect with Bluesky" and OAuth via your server. After login, the server redirects to its own URL; use that URL for the OAuth flow, or run app and server together locally.

## 4. Optional: Custom domain

In **Settings → Pages**, you can set a custom domain. The app uses relative paths, so it will work from any base URL.
