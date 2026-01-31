/**
 * blendsky — OAuth backend (Bluesky login)
 * Serves client metadata, jwks, auth flow, and timeline API.
 */

import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { JoseKey } from '@atproto/jwk-jose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// In-memory stores (use Redis/DB in production)
const stateStore = new Map();
const sessionStore = new Map();

async function createOAuthClient() {
  const privateKey = process.env.BLUESKY_OAUTH_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'Set BLUESKY_OAUTH_PRIVATE_KEY (ES256 JWK JSON string including "d"). Generate at https://jwkset.com/generate with ECDSA ES256.'
    );
  }

  const keyset = await Promise.all([
    JoseKey.fromImportable(privateKey.trim(), 'key1'),
  ]);

  const clientMetadata = {
    client_id: `${BASE_URL}/oauth/client-metadata.json`,
    application_type: 'web',
    client_name: 'blendsky',
    client_uri: BASE_URL,
    grant_types: ['authorization_code', 'refresh_token'],
    scope: 'atproto transition:generic',
    response_types: ['code'],
    redirect_uris: [`${BASE_URL}/api/auth/bluesky/callback`],
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
    jwks_uri: `${BASE_URL}/oauth/jwks.json`,
  };

  const client = new NodeOAuthClient({
    clientMetadata,
    keyset,
    stateStore: {
      async set(key, value) {
        stateStore.set(key, value);
        setTimeout(() => stateStore.delete(key), 60 * 60 * 1000);
      },
      async get(key) {
        return stateStore.get(key);
      },
      async del(key) {
        stateStore.delete(key);
      },
    },
    sessionStore: {
      async set(sub, session) {
        sessionStore.set(sub, session);
      },
      async get(sub) {
        return sessionStore.get(sub);
      },
      async del(sub) {
        sessionStore.delete(sub);
      },
    },
  });

  return client;
}

let oauthClient;

const app = express();
app.use(cookieParser());
app.use(express.json());

// OAuth discovery: client metadata (Bluesky fetches this as client_id)
app.get('/oauth/client-metadata.json', (req, res) => {
  res.type('application/json').json({
    client_id: `${BASE_URL}/oauth/client-metadata.json`,
    application_type: 'web',
    client_name: 'blendsky',
    client_uri: BASE_URL,
    grant_types: ['authorization_code', 'refresh_token'],
    scope: 'atproto transition:generic',
    response_types: ['code'],
    redirect_uris: [`${BASE_URL}/api/auth/bluesky/callback`],
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
    jwks_uri: `${BASE_URL}/oauth/jwks.json`,
  });
});

// JWKS (public key only — do not expose "d")
app.get('/oauth/jwks.json', (req, res) => {
  if (!oauthClient) {
    return res.status(503).json({ error: 'OAuth client not initialized' });
  }
  res.type('application/json').json(oauthClient.jwks);
});

// Start OAuth: redirect to Bluesky
app.get('/api/auth/bluesky', async (req, res, next) => {
  try {
    const handle = (req.query.handle || '').toString().trim();
    if (!handle) {
      return res.redirect(`${BASE_URL}/#bluesky?error=handle`);
    }
    const state = crypto.randomUUID();
    const ac = new AbortController();
    req.on('close', () => ac.abort());
    const url = await oauthClient.authorize(handle, {
      signal: ac.signal,
      state,
    });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

// OAuth callback: exchange code, set cookie, redirect to app
app.get('/api/auth/bluesky/callback', async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const { session } = await oauthClient.callback(params);
    const did = session.did;
    res
      .cookie('blendsky_did', did, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
        path: '/',
      })
      .redirect(`${BASE_URL}/#bluesky`);
  } catch (err) {
    next(err);
  }
});

// Who is connected (for frontend)
app.get('/api/bluesky/me', async (req, res, next) => {
  try {
    const did = req.cookies?.blendsky_did;
    if (!did) {
      return res.status(401).json({ error: 'Not connected' });
    }
    const session = await oauthClient.restore(did);
    if (!session) {
      res.clearCookie('blendsky_did', { path: '/' });
      return res.status(401).json({ error: 'Session expired' });
    }
    const agent = new Agent(session);
    const profile = await agent.getProfile({ actor: did }).catch(() => null);
    res.json({
      did,
      handle: profile?.data?.handle || did,
    });
  } catch (err) {
    next(err);
  }
});

// Timeline (feed from people you follow)
app.get('/api/bluesky/timeline', async (req, res, next) => {
  try {
    const did = req.cookies?.blendsky_did;
    if (!did) {
      return res.status(401).json({ error: 'Not connected' });
    }
    const session = await oauthClient.restore(did);
    if (!session) {
      res.clearCookie('blendsky_did', { path: '/' });
      return res.status(401).json({ error: 'Session expired' });
    }
    const agent = new Agent(session);
    const cursor = (req.query.cursor || '').toString() || undefined;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const result = await agent.getTimeline({ cursor, limit });
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

// Fetch AT record by URI (for app.blendsky.document import; public, no auth)
const APP_VIEW = 'https://api.bsky.app';
const PLC_DIRECTORY = 'https://plc.directory';

async function fetchAtRecord(repo, collection, rkey) {
  const params = `repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
  const appViewUrl = `${APP_VIEW}/xrpc/com.atproto.repo.getRecord?${params}`;
  const appRes = await fetch(appViewUrl);
  if (appRes.ok) return appRes.json();
  if (repo.startsWith('did:')) {
    const didRes = await fetch(`${PLC_DIRECTORY}/${encodeURIComponent(repo)}`);
    if (didRes.ok) {
      const didDoc = await didRes.json();
      const pds = didDoc.service?.find((s) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint;
      if (pds) {
        const pdsUrl = `${pds.replace(/\/$/, '')}/xrpc/com.atproto.repo.getRecord?${params}`;
        const pdsRes = await fetch(pdsUrl);
        if (pdsRes.ok) return pdsRes.json();
      }
    }
  }
  return null;
}

app.get('/api/at/record', async (req, res, next) => {
  try {
    const uri = (req.query.uri || '').toString().trim();
    if (!uri.startsWith('at://')) {
      return res.status(400).json({ error: 'Invalid AT URI' });
    }
    const parts = uri.replace(/^at:\/\//, '').split('/');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'AT URI must be at://repo/collection/rkey' });
    }
    const repo = parts[0];
    const collection = parts[1];
    const rkey = parts.slice(2).join('/');
    const data = await fetchAtRecord(repo, collection, rkey);
    if (!data) {
      return res.status(404).json({ error: 'Record not found or not public' });
    }
    res.json({
      uri: data.uri,
      cid: data.cid,
      value: data.value,
      repo,
      handle: data.handle,
      record: data.value,
    });
  } catch (err) {
    next(err);
  }
});

// Disconnect
app.post('/api/auth/bluesky/disconnect', async (req, res, next) => {
  try {
    const did = req.cookies?.blendsky_did;
    if (did) {
      await oauthClient.revoke(did).catch(() => {});
      sessionStore.delete(did);
    }
    res.clearCookie('blendsky_did', { path: '/' }).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Static app (serve from parent /app when running from server/)
app.use(express.static(path.join(__dirname, '..', 'app')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/oauth/')) return next();
  res.sendFile(path.join(__dirname, '..', 'app', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

createOAuthClient()
  .then((client) => {
    oauthClient = client;
    app.listen(PORT, () => {
      console.log(`blendsky server at ${BASE_URL}`);
      console.log('Bluesky: connect via OAuth (no app password).');
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
