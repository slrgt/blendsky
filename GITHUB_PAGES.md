# Deploy to GitHub Pages

## 1. Enable GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages**
3. **Source:** Deploy from a branch  
4. **Branch:** `main` (or `master`)  
5. **Folder:** `/ (root)`  
6. Save. The site will be at `https://<username>.github.io/<repo>/`.

## 2. Set OAuth origin (required for login)

Before login will work, set your site origin in the OAuth client metadata:

1. Open **forum/oauth/client-metadata.json**
2. Replace **every** `https://REPLACE_WITH_YOUR_ORIGIN` with your GitHub Pages origin (no trailing slash).

**Example:** If your repo is `https://github.com/alice/blender-forum`, your site is `https://alice.github.io/blender-forum/`. Use:

- Origin: `https://alice.github.io/blender-forum`
- So `client_id` becomes: `https://alice.github.io/blender-forum/forum/oauth/client-metadata.json`
- And `redirect_uris`: `["https://alice.github.io/blender-forum/forum/"]`

Commit and push the change. After that, “Log in with Bluesky” will redirect to Bluesky OAuth and back correctly.

## 3. Result

- **Site URL:** `https://<username>.github.io/<repo>/`  
- **Forum URL:** `https://<username>.github.io/<repo>/forum/`  
  (The root page redirects to `/forum/`.)

## Note

The **.nojekyll** file in the repo root tells GitHub Pages to serve the site as plain static files (no Jekyll). Keep it.
