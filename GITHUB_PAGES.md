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

- **Wiki** and **Forum** work (data in browser localStorage).
- **Bluesky OAuth and feed** do **not** work on GitHub Pages — there is no backend. The Bluesky section will show “Connect with Bluesky” but the redirect and API calls need the Node server. To use Bluesky, run the server locally (`cd server && npm start`) or deploy the server elsewhere and point the app at it.

## 4. Optional: Custom domain

In **Settings → Pages**, you can set a custom domain. The app uses relative paths, so it will work from any base URL.
