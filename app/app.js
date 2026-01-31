/**
 * blendsky — wikis, forums & Bluesky feed (timeline from who you follow)
 */

fetch('config.json')
  .then(function (r) { return r.json(); })
  .catch(function () { return {}; })
  .then(function (config) {
    var apiBase = (config && config.apiBase) || '';
    // Never use same-origin as OAuth backend (e.g. GitHub Pages has no /api/auth)
    var API = apiBase && apiBase.replace(/\/$/, '') !== window.location.origin ? apiBase : '';

    (function () {
      'use strict';

  var STORAGE_WIKI = 'blendsky_wiki';
  var STORAGE_FORUM = 'blendsky_forum';
  var STORAGE_BSKY = 'blendsky_session';
  var DEFAULT_PDS = 'https://bsky.social';
  var APP_VIEW = 'https://api.bsky.app';
  var PLC_DIRECTORY = 'https://plc.directory';

  // ——— Navigation ———
  const views = document.querySelectorAll('.view');
  const navLinks = document.querySelectorAll('[data-nav]');

  function showView(id) {
    const target = id === 'home' ? 'view-home' : 'view-' + id;
    views.forEach(function (v) {
      v.classList.toggle('view-active', v.id === target);
    });
    navLinks.forEach(function (a) {
      const linkNav = a.getAttribute('data-nav');
      a.classList.toggle('active', linkNav === id);
    });
    if (id === 'wiki') initWiki();
    if (id === 'forum') initForum();
    if (id === 'bluesky') initBluesky();
  }

  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showView(a.getAttribute('data-nav'));
    });
  });

  // ——— Wiki (localStorage) ———
  function getWikiPages() {
    try {
      const raw = localStorage.getItem(STORAGE_WIKI);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function setWikiPages(pages) {
    localStorage.setItem(STORAGE_WIKI, JSON.stringify(pages));
  }

  function slugify(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled';
  }

  function simpleMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return html;
  }

  let currentWikiSlug = null;

  function renderWikiList() {
    const pages = getWikiPages();
    const list = document.getElementById('wiki-list');
    const keys = Object.keys(pages).sort();
    list.innerHTML = keys.length
      ? keys
          .map(function (slug) {
            const title = pages[slug].title || slug;
            return '<li><a href="#" data-wiki-slug="' + slug + '">' + escapeHtml(title) + '</a></li>';
          })
          .join('')
      : '<li class="muted">No pages yet. Create one above.</li>';
    list.querySelectorAll('a[data-wiki-slug]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openWikiPage(a.getAttribute('data-wiki-slug'));
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function openWikiPage(slug) {
    const pages = getWikiPages();
    const page = pages[slug];
    if (!page) return;
    currentWikiSlug = slug;
    document.getElementById('wiki-title').textContent = page.title || slug;
    document.getElementById('wiki-body').innerHTML = simpleMarkdown(page.body || '');
    document.getElementById('wiki-view').classList.remove('hidden');
    document.getElementById('wiki-edit').classList.add('hidden');
  }

  function initWiki() {
    renderWikiList();
    const pages = getWikiPages();
    const firstSlug = Object.keys(pages)[0];
    if (firstSlug) openWikiPage(firstSlug);
    else {
      currentWikiSlug = null;
      document.getElementById('wiki-title').textContent = '';
      document.getElementById('wiki-body').innerHTML = '<p class="muted">Create a page or pick one from the list.</p>';
      document.getElementById('wiki-view').classList.remove('hidden');
      document.getElementById('wiki-edit').classList.add('hidden');
    }
  }

  document.getElementById('wiki-new').addEventListener('click', function () {
    currentWikiSlug = null;
    document.getElementById('wiki-edit-title').value = '';
    document.getElementById('wiki-edit-body').value = '';
    document.getElementById('wiki-view').classList.add('hidden');
    document.getElementById('wiki-edit').classList.remove('hidden');
  });

  document.getElementById('wiki-edit-btn').addEventListener('click', function () {
    if (!currentWikiSlug) return;
    const pages = getWikiPages();
    const page = pages[currentWikiSlug];
    if (!page) return;
    document.getElementById('wiki-edit-title').value = page.title || '';
    document.getElementById('wiki-edit-body').value = page.body || '';
    document.getElementById('wiki-view').classList.add('hidden');
    document.getElementById('wiki-edit').classList.remove('hidden');
  });

  document.getElementById('wiki-save').addEventListener('click', function () {
    const title = document.getElementById('wiki-edit-title').value.trim() || 'Untitled';
    const body = document.getElementById('wiki-edit-body').value;
    const pages = getWikiPages();
    const newSlug = slugify(title);
    if (currentWikiSlug && currentWikiSlug !== newSlug) delete pages[currentWikiSlug];
    pages[newSlug] = { title: title, body: body };
    setWikiPages(pages);
    currentWikiSlug = newSlug;
    renderWikiList();
    document.getElementById('wiki-title').textContent = title;
    document.getElementById('wiki-body').innerHTML = simpleMarkdown(body);
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-view').classList.remove('hidden');
  });

  document.getElementById('wiki-cancel').addEventListener('click', function () {
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-view').classList.remove('hidden');
    if (currentWikiSlug) openWikiPage(currentWikiSlug);
    else initWiki();
  });

  document.getElementById('wiki-search').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const q = this.value.trim().toLowerCase();
      if (!q) return;
      const pages = getWikiPages();
      const slug = slugify(q);
      if (pages[slug]) openWikiPage(slug);
      else {
        currentWikiSlug = null;
        document.getElementById('wiki-edit-title').value = q;
        document.getElementById('wiki-edit-body').value = '';
        document.getElementById('wiki-view').classList.add('hidden');
        document.getElementById('wiki-edit').classList.remove('hidden');
      }
    }
  });

  // ——— Forum (localStorage) ———
  function getForumData() {
    try {
      const raw = localStorage.getItem(STORAGE_FORUM);
      return raw ? JSON.parse(raw) : { threads: [], nextId: 1 };
    } catch (_) {
      return { threads: [], nextId: 1 };
    }
  }

  function setForumData(data) {
    localStorage.setItem(STORAGE_FORUM, JSON.stringify(data));
  }

  function renderThreadList() {
    const data = getForumData();
    const list = document.getElementById('forum-thread-list');
    const wrap = document.getElementById('forum-thread-view');
    const newWrap = document.getElementById('forum-new-view');
    list.classList.remove('hidden');
    wrap.classList.add('hidden');
    newWrap.classList.add('hidden');
    list.innerHTML =
      data.threads.length === 0
        ? '<p class="muted">No threads yet. Start one!</p>'
        : data.threads
            .slice()
            .reverse()
            .map(function (t) {
              return (
                '<a href="#" class="forum-thread-card" data-thread-id="' +
                t.id +
                '"><h3>' +
                escapeHtml(t.title) +
                '</h3><span class="meta">' +
                escapeHtml(t.author || 'Anonymous') +
                ' · ' +
                (t.replies ? t.replies.length : 0) +
                ' replies</span></a>'
              );
            })
            .join('');
    list.querySelectorAll('.forum-thread-card').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openThread(Number(a.getAttribute('data-thread-id')));
      });
    });
  }

  function openThread(id) {
    const data = getForumData();
    const thread = data.threads.find(function (t) {
      return t.id === id;
    });
    if (!thread) return;
    document.getElementById('forum-thread-list').classList.add('hidden');
    document.getElementById('forum-thread-view').classList.remove('hidden');
    const detail = document.getElementById('forum-thread-detail');
    var meta = escapeHtml(thread.author || 'Anonymous');
    if (thread.publishedAt) {
      meta += ' · ' + new Date(thread.publishedAt).toLocaleString();
    }
    if (thread.tags && thread.tags.length) {
      meta += ' · ' + thread.tags.map(function (tag) {
        return '<span class="forum-tag">' + escapeHtml(tag) + '</span>';
      }).join(' ');
    }
    var body = '<h2>' + escapeHtml(thread.title) + '</h2><p class="meta">' + meta + '</p>';
    if (thread.description) {
      body += '<p class="forum-description">' + escapeHtml(thread.description) + '</p>';
    }
    body += '<div class="forum-reply text">' + escapeHtml(thread.body || '').replace(/\n/g, '<br>') + '</div>';
    if (thread.atUri) {
      body += '<p class="forum-at-uri muted"><small>From <a href="' + escapeHtml(thread.atUri) + '" target="_blank" rel="noopener">' + escapeHtml(thread.atUri) + '</a></small></p>';
    }
    detail.innerHTML = body;
    const repliesList = document.getElementById('forum-replies-list');
    repliesList.innerHTML = (thread.replies || [])
      .map(function (r) {
        return (
          '<li class="forum-reply"><span class="author">' +
          escapeHtml(r.author || 'Anonymous') +
          '</span><div class="text">' +
          escapeHtml(r.text).replace(/\n/g, '<br>') +
          '</div></li>'
        );
      })
      .join('');
    document.getElementById('forum-reply-form').dataset.threadId = String(id);
    document.getElementById('forum-reply-body').value = '';
    var stdWrap = document.getElementById('forum-thread-standard');
    stdWrap.classList.remove('hidden');
    stdWrap.dataset.threadId = String(id);
  }

  document.getElementById('forum-new-thread').addEventListener('click', function () {
    document.getElementById('forum-thread-list').classList.add('hidden');
    document.getElementById('forum-thread-view').classList.add('hidden');
    document.getElementById('forum-new-view').classList.remove('hidden');
    document.getElementById('forum-new-title').value = '';
    document.getElementById('forum-new-path').value = '';
    document.getElementById('forum-new-description').value = '';
    document.getElementById('forum-new-body').value = '';
    document.getElementById('forum-new-tags').value = '';
  });

  document.getElementById('forum-new-cancel').addEventListener('click', function () {
    document.getElementById('forum-new-view').classList.add('hidden');
    renderThreadList();
  });

  document.getElementById('forum-new-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const data = getForumData();
    const id = data.nextId++;
    const title = document.getElementById('forum-new-title').value.trim();
    const body = document.getElementById('forum-new-body').value.trim();
    const pathRaw = document.getElementById('forum-new-path').value.trim().replace(/^\//, '');
    const description = document.getElementById('forum-new-description').value.trim();
    const tagsRaw = document.getElementById('forum-new-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    const now = new Date().toISOString();
    data.threads.push({
      id: id,
      title: title || 'Untitled',
      body: body,
      path: pathRaw || undefined,
      description: description || undefined,
      tags: tags.length ? tags : undefined,
      publishedAt: now,
      updatedAt: now,
      author: 'You',
      replies: []
    });
    setForumData(data);
    document.getElementById('forum-new-view').classList.add('hidden');
    renderThreadList();
    openThread(id);
  });

  document.getElementById('forum-back').addEventListener('click', function () {
    renderThreadList();
  });

  document.getElementById('forum-reply-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const id = Number(this.dataset.threadId);
    const text = document.getElementById('forum-reply-body').value.trim();
    if (!text) return;
    const data = getForumData();
    const thread = data.threads.find(function (t) {
      return t.id === id;
    });
    if (!thread) return;
    if (!thread.replies) thread.replies = [];
    thread.replies.push({ author: 'You', text: text });
    if (thread.updatedAt) thread.updatedAt = new Date().toISOString();
    setForumData(data);
    openThread(id);
  });

  document.getElementById('forum-export-standard').addEventListener('click', function () {
    const wrap = document.getElementById('forum-thread-standard');
    const id = wrap && wrap.dataset.threadId ? Number(wrap.dataset.threadId) : null;
    const data = getForumData();
    const thread = data.threads.find(function (t) { return t.id === id; });
    if (id == null || !thread || typeof StandardSite === 'undefined') return;
    const baseUrl = typeof location !== 'undefined' ? location.origin : '';
    const doc = StandardSite.documentFromThread(thread, baseUrl);
    const json = JSON.stringify({ $type: StandardSite.NS_DOCUMENT, ...doc, content: thread.body }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (thread.path || 'thread-' + id) + '.standard.site.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function fetchAtRecord(uri) {
    var parts = uri.replace(/^at:\/\//, '').split('/');
    if (parts.length < 3) return Promise.reject(new Error('Invalid AT URI'));
    var repo = parts[0];
    var collection = parts[1];
    var rkey = parts.slice(2).join('/');
    var params = 'repo=' + encodeURIComponent(repo) + '&collection=' + encodeURIComponent(collection) + '&rkey=' + encodeURIComponent(rkey);
    var url = APP_VIEW + '/xrpc/com.atproto.repo.getRecord?' + params;
    return fetch(url)
      .then(function (res) {
        if (res.ok) return res.json();
        if (repo.indexOf('did:') === 0) {
          return getPdsFromDid(repo).then(function (pdsUrl) {
            return fetch(pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.getRecord?' + params).then(function (r2) {
              if (!r2.ok) throw new Error(r2.statusText);
              return r2.json();
            });
          });
        }
        throw new Error(res.statusText);
      })
      .then(function (data) {
        return { value: data.value, uri: data.uri, repo: repo, record: data.value };
      });
  }

  document.getElementById('forum-import-btn').addEventListener('click', function () {
    var uriInput = document.getElementById('forum-import-uri');
    var uri = (uriInput && uriInput.value && uriInput.value.trim()) || '';
    if (!uri || uri.indexOf('at://') !== 0) {
      alert('Enter a valid AT URI (e.g. at://did:plc:…/site.standard.document/…)');
      return;
    }
    var req = API
      ? fetch(API + '/api/at/record?uri=' + encodeURIComponent(uri), { credentials: 'include' }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
      : fetchAtRecord(uri);
    req
      .then(function (data) {
        if (typeof StandardSite === 'undefined') throw new Error('StandardSite not loaded');
        var record = data.value || data.record || data;
        var author = data.handle || (data.repo && data.repo.indexOf('did:') === 0 ? 'AT' : '');
        var thread = StandardSite.recordToThread(record, uri, author);
        if (!thread) throw new Error('Could not parse document');
        var forumData = getForumData();
        var newId = forumData.nextId++;
        thread.id = newId;
        forumData.threads.push(thread);
        setForumData(forumData);
        renderThreadList();
        openThread(newId);
        uriInput.value = '';
      })
      .catch(function (err) {
        alert('Import failed: ' + (err.message || 'unknown'));
      });
  });

  function initForum() {
    renderThreadList();
  }

  // ——— Bluesky (serverless: app password + PDS, or server: OAuth) ———
  function getStoredSession() {
    try {
      var raw = localStorage.getItem(STORAGE_BSKY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setStoredSession(session) {
    if (session) localStorage.setItem(STORAGE_BSKY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_BSKY);
  }

  function resolveHandle(handle) {
    return fetch(DEFAULT_PDS + '/xrpc/com.atproto.identity.resolveHandle?handle=' + encodeURIComponent(handle))
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.did || null; });
  }

  function getPdsFromDid(did) {
    return fetch(PLC_DIRECTORY + '/' + encodeURIComponent(did))
      .then(function (r) { return r.json(); })
      .then(function (doc) {
        var svc = doc.service && doc.service.find(function (s) { return s.type === 'AtprotoPersonalDataServer'; });
        return svc ? (svc.serviceEndpoint || DEFAULT_PDS) : DEFAULT_PDS;
      })
      .catch(function () { return DEFAULT_PDS; });
  }

  function renderBlueskyFeed(items, append) {
    const wrap = document.getElementById('bluesky-feed');
    if (!append) wrap.innerHTML = '';
    items.forEach(function (item) {
      const post = item.post || item;
      const author = post.author;
      const handle = author && author.handle ? author.handle : '?';
      const text = post.record && post.record.text ? post.record.text : '';
      const createdAt = post.record && post.record.createdAt ? post.record.createdAt : '';
      const date = createdAt ? new Date(createdAt).toLocaleString() : '';
      const el = document.createElement('div');
      el.className = 'bsky-post';
      el.innerHTML =
        '<div class="author"><span class="author-handle">' +
        escapeHtml(handle) +
        '</span><span class="author-did">@' +
        escapeHtml((author && author.did) || '') +
        '</span></div><div class="text">' +
        escapeHtml(text).replace(/\n/g, '<br>') +
        '</div><div class="time">' +
        escapeHtml(date) +
        '</div>';
      wrap.appendChild(el);
    });
  }

  function loadBlueskyTimeline(cursor, append) {
    if (API) {
      var url = API + '/api/bluesky/timeline?limit=30';
      if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
      return fetch(url, { credentials: 'include' })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status === 401 ? 'Not connected' : res.statusText);
          return res.json();
        })
        .then(function (data) {
          var items = data.feed || [];
          renderBlueskyFeed(items, append);
          var nextCursor = data.cursor;
          var loadMore = document.getElementById('bluesky-load-more');
          if (nextCursor) {
            loadMore.classList.remove('hidden');
            loadMore.dataset.cursor = nextCursor;
          } else {
            loadMore.classList.add('hidden');
          }
          return data;
        });
    }
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected'));
    var url = session.pdsUrl.replace(/\/$/, '') + '/xrpc/app.bsky.feed.getTimeline?limit=30';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
    return fetch(url, { headers: { Authorization: 'Bearer ' + session.accessJwt } })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status === 401 ? 'Not connected' : res.statusText);
        return res.json();
      })
      .then(function (data) {
        var items = data.feed || [];
        renderBlueskyFeed(items, append);
        var nextCursor = data.cursor;
        var loadMore = document.getElementById('bluesky-load-more');
        if (nextCursor) {
          loadMore.classList.remove('hidden');
          loadMore.dataset.cursor = nextCursor;
        } else {
          loadMore.classList.add('hidden');
        }
        return data;
      });
  }

  function initBluesky() {
    var connect = document.getElementById('bluesky-connect');
    var feedWrap = document.getElementById('bluesky-feed-wrap');
    var feed = document.getElementById('bluesky-feed');
    var userSpan = document.getElementById('bluesky-user');
    var appPw = document.getElementById('bluesky-app-password');
    var hintServerless = document.getElementById('bluesky-hint-serverless');
    var hintOauth = document.getElementById('bluesky-hint-oauth');

    if (API) {
      if (hintServerless) hintServerless.classList.add('hidden');
      if (hintOauth) hintOauth.classList.remove('hidden');
      if (appPw) appPw.classList.add('hidden');
      fetch(API + '/api/bluesky/me', { credentials: 'include' })
        .then(function (res) {
          if (!res.ok) {
            connect.classList.remove('hidden');
            feedWrap.classList.add('hidden');
            return null;
          }
          return res.json();
        })
        .then(function (me) {
          if (!me) return;
          connect.classList.add('hidden');
          feedWrap.classList.remove('hidden');
          userSpan.textContent = 'Connected as @' + (me.handle || me.did);
          feed.innerHTML = '<p class="muted">Loading your timeline…</p>';
          return loadBlueskyTimeline(null, false);
        })
        .then(function () {})
        .catch(function (err) {
          connect.classList.remove('hidden');
          feedWrap.classList.add('hidden');
          if (err.message !== 'Not connected' && err.message !== 'Failed to fetch') {
            feed.innerHTML = '<p class="muted">Error: ' + escapeHtml(err.message) + '</p>';
          }
        });
      return;
    }

    if (hintServerless) hintServerless.classList.remove('hidden');
    if (hintOauth) hintOauth.classList.add('hidden');
    if (appPw) appPw.classList.remove('hidden');

    var session = getStoredSession();
    if (session && session.accessJwt && session.handle) {
      connect.classList.add('hidden');
      feedWrap.classList.remove('hidden');
      userSpan.textContent = 'Connected as @' + session.handle;
      feed.innerHTML = '<p class="muted">Loading your timeline…</p>';
      loadBlueskyTimeline(null, false)
        .then(function () {})
        .catch(function (err) {
          connect.classList.remove('hidden');
          feedWrap.classList.add('hidden');
          feed.innerHTML = '<p class="muted">Session expired or error. ' + escapeHtml(err.message) + '</p>';
        });
    } else {
      connect.classList.remove('hidden');
      feedWrap.classList.add('hidden');
    }
  }

  document.getElementById('bluesky-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var handle = document.getElementById('bluesky-handle').value.trim();
    if (!handle) return;
    if (API) {
      window.location.href = API + '/api/auth/bluesky?handle=' + encodeURIComponent(handle);
      return;
    }
    var appPassword = (document.getElementById('bluesky-app-password') && document.getElementById('bluesky-app-password').value) || '';
    if (!appPassword) {
      alert('Enter your app password (create one at bsky.app/settings/app-passwords).');
      return;
    }
    document.getElementById('bluesky-connect').classList.add('hidden');
    document.getElementById('bluesky-feed-wrap').classList.remove('hidden');
    document.getElementById('bluesky-feed').innerHTML = '<p class="muted">Connecting…</p>';
    var feed = document.getElementById('bluesky-feed');
    resolveHandle(handle)
      .then(function (did) { return did ? getPdsFromDid(did) : Promise.reject(new Error('Could not resolve handle')); })
      .then(function (pdsUrl) {
        return fetch(pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.server.createSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: handle, password: appPassword })
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || r.statusText); });
          return r.json();
        }).then(function (data) {
          setStoredSession({
            accessJwt: data.accessJwt,
            refreshJwt: data.refreshJwt,
            handle: data.handle || handle,
            pdsUrl: pdsUrl
          });
          return pdsUrl;
        });
      })
      .then(function () {
        document.getElementById('bluesky-connect').classList.add('hidden');
        document.getElementById('bluesky-feed-wrap').classList.remove('hidden');
        document.getElementById('bluesky-user').textContent = 'Connected as @' + (getStoredSession() && getStoredSession().handle);
        return loadBlueskyTimeline(null, false);
      })
      .then(function () {})
      .catch(function (err) {
        document.getElementById('bluesky-connect').classList.remove('hidden');
        document.getElementById('bluesky-feed-wrap').classList.add('hidden');
        document.getElementById('bluesky-feed').innerHTML = '<p class="muted">Login failed: ' + escapeHtml(err.message) + '</p>';
      });
  });

  document.getElementById('bluesky-disconnect').addEventListener('click', function () {
    if (API) {
      fetch(API + '/api/auth/bluesky/disconnect', {
        method: 'POST',
        credentials: 'include'
      }).then(function () {
        document.getElementById('bluesky-connect').classList.remove('hidden');
        document.getElementById('bluesky-feed-wrap').classList.add('hidden');
        document.getElementById('bluesky-handle').value = '';
        initBluesky();
      });
      return;
    }
    setStoredSession(null);
    document.getElementById('bluesky-connect').classList.remove('hidden');
    document.getElementById('bluesky-feed-wrap').classList.add('hidden');
    document.getElementById('bluesky-handle').value = '';
    if (document.getElementById('bluesky-app-password')) document.getElementById('bluesky-app-password').value = '';
    initBluesky();
  });

  document.getElementById('bluesky-load-more').addEventListener('click', function () {
    const cursor = this.dataset.cursor;
    if (!cursor) return;
    this.disabled = true;
    loadBlueskyTimeline(cursor, true).then(function () {
      document.getElementById('bluesky-load-more').disabled = false;
    }).catch(function () {
      document.getElementById('bluesky-load-more').disabled = false;
    });
  });

  // Start on home
  showView('home');
    })();
  });
