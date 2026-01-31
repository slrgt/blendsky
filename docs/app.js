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
  var PUBLIC_APP_VIEW = 'https://public.api.bsky.app';
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
    if (id === 'home') {
      loadHomeRecent();
      loadDiscoverB3d();
      loadConstellationStats();
    }
  }

  function formatStat(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function loadConstellationStats() {
    var block = document.getElementById('home-constellation');
    var list = document.getElementById('constellation-stats');
    if (!block || !list) return;
    fetch('https://constellation.microcosm.blue/', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var s = data.stats || {};
        block.classList.remove('hidden');
        list.innerHTML =
          '<dt>Identities (DIDs)</dt><dd>' + formatStat(s.dids) + '</dd>' +
          '<dt>Targetables</dt><dd>' + formatStat(s.targetables) + '</dd>' +
          '<dt>Linking records</dt><dd>' + formatStat(s.linking_records) + '</dd>' +
          (data.days_indexed != null ? '<dt>Days indexed</dt><dd>' + data.days_indexed + '</dd>' : '');
      })
      .catch(function () {
        block.classList.add('hidden');
      });
  }

  function loadHomeRecent() {
    var wrap = document.getElementById('home-recent-feed');
    if (!wrap) return;
    var wikiPages = getWikiPages();
    var forumData = getForumData();
    var wikiKeys = Object.keys(wikiPages).sort().slice(-5).reverse();
    var threads = (forumData.threads || []).slice().reverse().slice(0, 5);
    var parts = [];
    wikiKeys.forEach(function (slug) {
      var p = wikiPages[slug];
      var title = (p && p.title) || slug;
      parts.push('<a href="#" class="home-recent-item" data-nav="wiki" data-wiki-slug="' + escapeHtml(slug) + '"><span class="home-recent-type">Wiki</span> ' + escapeHtml(title) + '</a>');
    });
    threads.forEach(function (t) {
      parts.push('<a href="#" class="home-recent-item" data-nav="forum" data-thread-id="' + t.id + '"><span class="home-recent-type">Forum</span> ' + escapeHtml(t.title || 'Untitled') + '</a>');
    });
    if (parts.length === 0) {
      wrap.innerHTML = '<p class="muted">No wiki pages or forum threads yet. Create one from Wiki or Forum.</p>';
      return;
    }
    wrap.innerHTML = parts.join('');
    wrap.querySelectorAll('.home-recent-item').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var nav = a.getAttribute('data-nav');
        if (nav === 'wiki') {
          showView('wiki');
          openWikiPage(a.getAttribute('data-wiki-slug'));
        } else if (nav === 'forum') {
          showView('forum');
          openThread(Number(a.getAttribute('data-thread-id')));
        }
      });
    });
  }

  function loadDiscoverB3d() {
    var wrap = document.getElementById('home-discover-feed');
    var loading = document.getElementById('home-discover-loading');
    if (!wrap || !loading) return;
    var url = PUBLIC_APP_VIEW + '/xrpc/app.bsky.feed.searchPosts?q=' + encodeURIComponent('#b3d') + '&limit=8&sort=latest';
    fetch(url)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || r.statusText); });
        return r.json();
      })
      .then(function (data) {
        var posts = (data && data.posts) || (data && data.feed) || [];
        loading.classList.add('hidden');
        if (posts.length === 0) {
          wrap.innerHTML = '<p class="muted">No #b3d posts right now. <a href="https://bsky.app/search?q=%23b3d" target="_blank" rel="noopener">See #b3d on Bluesky</a>.</p>';
          return;
        }
        wrap.innerHTML = posts.map(function (p) {
          var author = p.author || {};
          var handle = author.handle || author.did || '?';
          var text = (p.record && p.record.text) ? String(p.record.text).slice(0, 160) : '';
          if (text.length === 160) text += '…';
          var postUri = p.uri ? 'https://bsky.app/profile/' + (author.did || p.uri.split('/')[2]) + '/post/' + (p.uri.split('/').pop() || '') : '#';
          return (
            '<a href="' + escapeHtml(postUri) + '" target="_blank" rel="noopener" class="discover-card">' +
              '<span class="discover-handle">@' + escapeHtml(handle) + '</span>' +
              '<p class="discover-text">' + escapeHtml(text).replace(/\n/g, ' ') + '</p>' +
            '</a>'
          );
        }).join('');
      })
      .catch(function () {
        loading.classList.add('hidden');
        wrap.innerHTML = '<p class="muted">See <a href="https://bsky.app/search?q=%23b3d" target="_blank" rel="noopener">#b3d on Bluesky</a> for recent posts.</p>';
      });
  }

  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showView(a.getAttribute('data-nav'));
    });
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      var target = e.target;
      var form = target && target.closest && target.closest('form');
      if (form) {
        e.preventDefault();
        form.requestSubmit();
        return;
      }
      if (target && (target.id === 'wiki-edit-title' || target.id === 'wiki-edit-body')) {
        e.preventDefault();
        var saveBtn = document.getElementById('wiki-save');
        if (saveBtn && !document.getElementById('wiki-edit').classList.contains('hidden')) saveBtn.click();
      }
    }
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
            const page = pages[slug];
            const status = syncingWikiSlug === slug ? 'syncing' : (page.atUri ? 'synced' : 'local');
            const badge = '<span class="sync-badge sync-' + status + '" data-wiki-status="' + status + '">' + (status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced' : 'Local') + '</span>';
            return '<li><a href="#" data-wiki-slug="' + slug + '">' + escapeHtml(title) + '</a> ' + badge + '</li>';
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
    var bodyHtml = simpleMarkdown(page.body || '');
    if (page.remixedFrom) {
      bodyHtml = '<p class="wiki-remixed-from muted"><small>Remixed from: <a href="' + escapeHtml(page.remixedFrom) + '" target="_blank" rel="noopener">' + escapeHtml(page.remixedFrom) + '</a></small></p>' + bodyHtml;
    }
    document.getElementById('wiki-body').innerHTML = bodyHtml;
    document.getElementById('wiki-view').classList.remove('hidden');
    document.getElementById('wiki-edit').classList.add('hidden');
    updateWikiStatus(slug);
    var reqEdit = document.getElementById('wiki-request-edit');
    if (reqEdit) reqEdit.classList.toggle('hidden', !page.atUri);
  }

  function updateWikiStatus(slug) {
    var el = document.getElementById('wiki-sync-status');
    if (!el) return;
    if (!slug) {
      el.textContent = '';
      el.className = 'sync-status';
      return;
    }
    var pages = getWikiPages();
    var page = pages[slug];
    var status = syncingWikiSlug === slug ? 'syncing' : (page && page.atUri ? 'synced' : 'local');
    el.className = 'sync-status sync-' + status;
    el.textContent = status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced to Bluesky' : 'Local only';
  }

  function initWiki() {
    renderWikiList();
    const pages = getWikiPages();
    const firstSlug = Object.keys(pages)[0];
    if (firstSlug) openWikiPage(firstSlug);
    else {
      currentWikiSlug = null;
      updateWikiStatus(null);
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
    var existing = currentWikiSlug && pages[currentWikiSlug] ? pages[currentWikiSlug] : null;
    pages[newSlug] = { title: title, body: body };
    if (existing) {
      if (existing.atUri) pages[newSlug].atUri = existing.atUri;
      if (existing.remixedFrom) pages[newSlug].remixedFrom = existing.remixedFrom;
    }
    setWikiPages(pages);
    currentWikiSlug = newSlug;
    renderWikiList();
    document.getElementById('wiki-title').textContent = title;
    document.getElementById('wiki-body').innerHTML = simpleMarkdown(body);
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-view').classList.remove('hidden');
    updateWikiStatus(newSlug);
    var session = getStoredSession();
    if (session && session.accessJwt && typeof StandardSite !== 'undefined') {
      syncingWikiSlug = newSlug;
      updateWikiStatus(newSlug);
      doSyncWikiPage(newSlug).then(function () {
        renderWikiList();
        updateWikiStatus(newSlug);
      }).catch(function (err) {
        updateWikiStatus(newSlug);
        if (err && err.message) alert('Sync failed: ' + err.message);
      });
    }
  });

  document.getElementById('wiki-cancel').addEventListener('click', function () {
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-view').classList.remove('hidden');
    if (currentWikiSlug) openWikiPage(currentWikiSlug);
    else initWiki();
  });

  document.getElementById('wiki-sync-bluesky').addEventListener('click', function () {
    if (!currentWikiSlug) {
      alert('Open or create a page first.');
      return;
    }
    var session = getStoredSession();
    if (!session || !session.accessJwt) {
      alert('Connect your Bluesky account first (Bluesky tab).');
      return;
    }
    if (typeof StandardSite === 'undefined') {
      alert('Standard.site script not loaded.');
      return;
    }
    var btn = this;
    btn.disabled = true;
    syncingWikiSlug = currentWikiSlug;
    updateWikiStatus(currentWikiSlug);
    doSyncWikiPage(currentWikiSlug)
      .then(function () {
        renderWikiList();
        updateWikiStatus(currentWikiSlug);
        btn.textContent = 'Synced';
        setTimeout(function () { btn.textContent = 'Sync to Bluesky'; }, 2000);
      })
      .catch(function (err) {
        updateWikiStatus(currentWikiSlug);
        alert('Sync failed: ' + (err.message || 'unknown'));
      })
      .then(function () { btn.disabled = false; });
  });

  document.getElementById('wiki-request-edit').addEventListener('click', function () {
    if (!currentWikiSlug) return;
    var pages = getWikiPages();
    var page = pages[currentWikiSlug];
    if (!page || !page.atUri) return;
    var text = 'Requesting edit access to “' + (page.title || 'Untitled') + '”: ' + page.atUri;
    var url = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener');
  });

  document.getElementById('wiki-remix').addEventListener('click', function () {
    if (!currentWikiSlug) return;
    var pages = getWikiPages();
    var page = pages[currentWikiSlug];
    if (!page) return;
    var baseTitle = page.title || 'Untitled';
    var newTitle = baseTitle + ' (remix)';
    var newSlug = slugify(newTitle);
    var body = page.body || '';
    if (page.atUri) body = 'Remixed from: ' + page.atUri + '\n\n' + body;
    var newPage = { title: newTitle, body: body };
    if (page.atUri) newPage.remixedFrom = page.atUri;
    pages[newSlug] = newPage;
    setWikiPages(pages);
    currentWikiSlug = newSlug;
    renderWikiList();
    document.getElementById('wiki-edit-title').value = newTitle;
    document.getElementById('wiki-edit-body').value = newPage.body;
    document.getElementById('wiki-view').classList.add('hidden');
    document.getElementById('wiki-edit').classList.remove('hidden');
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
              var status = syncingForumId === t.id ? 'syncing' : (t.atUri ? 'synced' : 'local');
              var badge = '<span class="sync-badge sync-' + status + '">' + (status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced' : 'Local') + '</span>';
              return (
                '<a href="#" class="forum-thread-card" data-thread-id="' +
                t.id +
                '"><h3>' +
                escapeHtml(t.title) +
                '</h3><span class="meta">' +
                escapeHtml(t.author || 'Anonymous') +
                ' · ' +
                (t.replies ? t.replies.length : 0) +
                ' replies</span> ' +
                badge +
                '</a>'
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
    var threadStatus = syncingForumId === id ? 'Syncing…' : (thread.atUri ? 'Synced to Bluesky' : 'Local only');
    var body = '<h2>' + escapeHtml(thread.title) + '</h2><p class="meta">' + meta + '</p><p class="sync-status sync-' + (thread.atUri ? 'synced' : 'local') + '" id="forum-thread-sync-status">' + escapeHtml(threadStatus) + '</p>';
    if (thread.description) {
      body += '<p class="forum-description">' + escapeHtml(thread.description) + '</p>';
    }
    body += '<div class="forum-reply text">' + escapeHtml(thread.body || '').replace(/\n/g, '<br>') + '</div>';
    if (thread.atUri) {
      body += '<p class="forum-at-uri muted"><small>Document: <a href="' + escapeHtml(thread.atUri) + '" target="_blank" rel="noopener">' + escapeHtml(thread.atUri) + '</a></small></p>';
    }
    var replyPostUrl = thread.feedPostUri ? feedPostUriToBskyUrl(thread.feedPostUri) : null;
    if (replyPostUrl) {
      body += '<p class="forum-reply-on-bluesky"><a href="' + escapeHtml(replyPostUrl) + '" target="_blank" rel="noopener" class="btn btn-secondary">Reply on Bluesky</a></p>';
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
    var session = getStoredSession();
    if (session && session.accessJwt && typeof StandardSite !== 'undefined') {
      doSyncForumThread(id).then(function () {
        renderThreadList();
        openThread(id);
      }).catch(function (err) {
        openThread(id);
        if (err && err.message) alert('Sync failed: ' + err.message);
      });
    }
  });

  document.getElementById('forum-back').addEventListener('click', function () {
    document.getElementById('forum-thread-list').classList.remove('hidden');
    document.getElementById('forum-thread-view').classList.add('hidden');
    document.getElementById('forum-edit-view').classList.add('hidden');
    renderThreadList();
  });

  document.getElementById('forum-edit-thread-btn').addEventListener('click', function () {
    var wrap = document.getElementById('forum-thread-standard');
    var id = wrap && wrap.dataset.threadId ? Number(wrap.dataset.threadId) : null;
    var data = getForumData();
    var thread = data.threads.find(function (t) { return t.id === id; });
    if (id == null || !thread) return;
    document.getElementById('forum-edit-title').value = thread.title || '';
    document.getElementById('forum-edit-path').value = thread.path ? thread.path.replace(/^\//, '') : '';
    document.getElementById('forum-edit-description').value = thread.description || '';
    document.getElementById('forum-edit-body').value = thread.body || '';
    document.getElementById('forum-edit-tags').value = (thread.tags && thread.tags.length) ? thread.tags.join(', ') : '';
    document.getElementById('forum-edit-view').dataset.editingThreadId = String(id);
    document.getElementById('forum-thread-view').classList.add('hidden');
    document.getElementById('forum-edit-view').classList.remove('hidden');
  });

  document.getElementById('forum-edit-cancel').addEventListener('click', function () {
    document.getElementById('forum-edit-view').classList.add('hidden');
    document.getElementById('forum-thread-view').classList.remove('hidden');
  });

  document.getElementById('forum-edit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = Number(document.getElementById('forum-edit-view').dataset.editingThreadId);
    if (!id) return;
    var data = getForumData();
    var thread = data.threads.find(function (t) { return t.id === id; });
    if (!thread) return;
    thread.title = document.getElementById('forum-edit-title').value.trim() || 'Untitled';
    thread.body = document.getElementById('forum-edit-body').value.trim();
    thread.path = document.getElementById('forum-edit-path').value.trim().replace(/^\//, '') || undefined;
    thread.description = document.getElementById('forum-edit-description').value.trim() || undefined;
    var tagsRaw = document.getElementById('forum-edit-tags').value.trim();
    thread.tags = tagsRaw ? tagsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : undefined;
    thread.updatedAt = new Date().toISOString();
    setForumData(data);
    document.getElementById('forum-edit-view').classList.add('hidden');
    document.getElementById('forum-thread-view').classList.remove('hidden');
    openThread(id);
    renderThreadList();
    var session = getStoredSession();
    if (session && session.accessJwt && typeof StandardSite !== 'undefined') {
      syncingForumId = id;
      var statusEl = document.getElementById('forum-thread-sync-status');
      if (statusEl) { statusEl.textContent = 'Syncing…'; statusEl.className = 'sync-status sync-syncing'; }
      doSyncForumThread(id).then(function () {
        renderThreadList();
        openThread(id);
      }).catch(function (err) {
        openThread(id);
        if (err && err.message) alert('Sync failed: ' + err.message);
      });
    }
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

  document.getElementById('forum-sync-bluesky').addEventListener('click', function () {
    var wrap = document.getElementById('forum-thread-standard');
    var id = wrap && wrap.dataset.threadId ? Number(wrap.dataset.threadId) : null;
    var data = getForumData();
    var thread = data.threads.find(function (t) { return t.id === id; });
    if (id == null || !thread) return;
    var session = getStoredSession();
    if (!session || !session.accessJwt) {
      alert('Connect your Bluesky account first (Bluesky tab).');
      return;
    }
    if (typeof StandardSite === 'undefined') {
      alert('Standard.site script not loaded.');
      return;
    }
    var btn = this;
    btn.disabled = true;
    var statusEl = document.getElementById('forum-thread-sync-status');
    if (statusEl) { statusEl.textContent = 'Syncing…'; statusEl.className = 'sync-status sync-syncing'; }
    doSyncForumThread(id)
      .then(function () {
        renderThreadList();
        openThread(id);
        btn.textContent = 'Synced';
        setTimeout(function () { btn.textContent = 'Sync to Bluesky'; }, 2000);
      })
      .catch(function (err) {
        openThread(id);
        alert('Sync failed: ' + (err.message || 'unknown'));
      })
      .then(function () { btn.disabled = false; });
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

  /** Resolve a pckt.blog (or similar) URL to an at:// URI. Returns a promise that resolves to the at URI. */
  function resolveUrlToAtUri(url) {
    var trimmed = url.trim();
    if (trimmed.indexOf('at://') === 0) return Promise.resolve(trimmed);
    if (trimmed.indexOf('http://') !== 0 && trimmed.indexOf('https://') !== 0) return Promise.reject(new Error('Not a URL or AT URI'));
    try {
      var u = new URL(trimmed);
      var path = u.pathname.replace(/\/$/, '');
      var m = /^\/b\/([^/]+)\/([^/]+)$/.exec(path);
      if (m) {
        var handlePart = m[1];
        var pathPart = m[2];
        var handle = handlePart.indexOf('.') !== -1 ? handlePart : handlePart + '.bsky.social';
        return resolveHandle(handle).then(function (did) {
          if (!did) return Promise.reject(new Error('Could not resolve handle: ' + handle));
          var ns = typeof StandardSite !== 'undefined' ? StandardSite.NS_DOCUMENT : 'site.standard.document';
          var rkeysToTry = [pathPart];
          var lastSegment = pathPart.lastIndexOf('-') !== -1 ? pathPart.slice(pathPart.lastIndexOf('-') + 1) : pathPart;
          if (lastSegment && lastSegment !== pathPart) rkeysToTry.push(lastSegment);
          function tryNext(i) {
            if (i >= rkeysToTry.length) return Promise.reject(new Error('Document not found at that URL'));
            var rkey = rkeysToTry[i];
            var atUri = 'at://' + did + '/' + ns + '/' + rkey;
            return fetchAtRecord(atUri).then(function (data) { return data.uri; }).catch(function () { return tryNext(i + 1); });
          }
          return tryNext(0);
        });
      }
      return Promise.reject(new Error('URL format not recognized. Use an at:// URI or a pckt.blog /b/handle/slug URL.'));
    } catch (e) {
      return Promise.reject(e.message ? new Error(e.message) : e);
    }
  }

  document.getElementById('forum-import-btn').addEventListener('click', function () {
    var uriInput = document.getElementById('forum-import-uri');
    var raw = (uriInput && uriInput.value && uriInput.value.trim()) || '';
    if (!raw) {
      alert('Enter an AT URI (at://did:plc:…/site.standard.document/…) or a URL (e.g. https://pckt.blog/b/you/slug).');
      return;
    }
    var atUriPromise = (raw.indexOf('at://') === 0)
      ? Promise.resolve(raw)
      : resolveUrlToAtUri(raw);
    atUriPromise.then(function (uri) {
      var req = API
        ? fetch(API + '/api/at/record?uri=' + encodeURIComponent(uri), { credentials: 'include' }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
        : fetchAtRecord(uri);
      return req.then(function (data) {
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
      });
    }).catch(function (err) {
      alert('Import failed: ' + (err.message || 'unknown'));
    });
  });

  function loadForumDiscover() {
    var wrap = document.getElementById('forum-discover-feed');
    var loading = document.getElementById('forum-discover-loading');
    if (!wrap || !loading) return;
    var q = encodeURIComponent('#blendsky-forum');
    var url = PUBLIC_APP_VIEW + '/xrpc/app.bsky.feed.searchPosts?q=' + q + '&limit=10&sort=latest';
    fetch(url)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || r.statusText); });
        return r.json();
      })
      .then(function (data) {
        var posts = (data && data.posts) || (data && data.feed) || [];
        loading.classList.add('hidden');
        if (posts.length === 0) {
          wrap.innerHTML = '<p class="muted">No #blendsky-forum threads yet. Sync a thread to add the tag.</p>';
          return;
        }
        wrap.innerHTML = posts.map(function (p) {
          var author = p.author || {};
          var handle = author.handle || author.did || '?';
          var text = (p.record && p.record.text) ? String(p.record.text).slice(0, 120) : '';
          if (text.length === 120) text += '…';
          var postUri = p.uri ? feedPostUriToBskyUrl(p.uri) : null;
          if (!postUri) postUri = 'https://bsky.app/profile/' + (author.did || '') + '/post/' + (p.uri ? p.uri.split('/').pop() : '');
          return (
            '<a href="' + escapeHtml(postUri) + '" target="_blank" rel="noopener" class="forum-discover-card">' +
              '<span class="discover-handle">@' + escapeHtml(handle) + '</span>' +
              '<p class="discover-text">' + escapeHtml(text).replace(/\n/g, ' ') + '</p>' +
            '</a>'
          );
        }).join('');
      })
      .catch(function () {
        loading.classList.add('hidden');
        wrap.innerHTML = '<p class="muted">See <a href="https://bsky.app/search?q=%23blendsky-forum" target="_blank" rel="noopener">#blendsky-forum on Bluesky</a> for forum threads.</p>';
      });
  }

  function initForum() {
    renderThreadList();
    loadForumDiscover();
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

  /** Ensure session has did (resolve from handle if missing). */
  function ensureSessionDid(session) {
    if (session.did) return Promise.resolve(session);
    if (!session.handle) return Promise.reject(new Error('No handle or DID'));
    return resolveHandle(session.handle).then(function (did) {
      if (!did) return Promise.reject(new Error('Could not resolve DID'));
      session.did = did;
      setStoredSession(session);
      return session;
    });
  }

  var BSKY_POST_MAX = 300;

  /** Put a record (with rkey) into the logged-in user's Bluesky repo. */
  function putRecordToBluesky(collection, rkey, record) {
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected to Bluesky'));
    return ensureSessionDid(session).then(function (s) {
      var url = s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.putRecord';
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + s.accessJwt
        },
        body: JSON.stringify({
          repo: s.did,
          collection: collection,
          rkey: rkey,
          record: record
        })
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw new Error(err.message || err.error || res.statusText); });
        return res.json();
      });
    });
  }

  /** Create a record (rkey auto-generated) in the logged-in user's Bluesky repo. Returns { uri, cid }. */
  function createRecordToBluesky(collection, record) {
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected to Bluesky'));
    return ensureSessionDid(session).then(function (s) {
      var url = s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.createRecord';
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + s.accessJwt
        },
        body: JSON.stringify({
          repo: s.did,
          collection: collection,
          record: record
        })
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw new Error(err.message || err.error || res.statusText); });
        return res.json();
      });
    });
  }

  /** Convert feed post AT URI to bsky.app profile/post URL for replying. */
  function feedPostUriToBskyUrl(atUri) {
    if (!atUri || atUri.indexOf('at://') !== 0) return null;
    var parts = atUri.replace(/^at:\/\//, '').split('/');
    if (parts.length < 3) return null;
    var did = parts[0];
    var rkey = parts[parts.length - 1];
    return 'https://bsky.app/profile/' + encodeURIComponent(did) + '/post/' + encodeURIComponent(rkey);
  }

  /** Sanitize string for use as AT record rkey (alphanumeric, dots, underscores, hyphens). */
  function sanitizeRkey(s) {
    return String(s).replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  }

  /** Strip markdown to plain text (rough). */
  function stripMarkdown(text) {
    if (!text) return '';
    return String(text)
      .replace(/\n#{1,6}\s+/g, '\n')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Split text into chunks by sentence boundaries, each chunk <= maxLen. */
  function splitSentences(text, maxLen) {
    if (!text || maxLen < 1) return [];
    var plain = stripMarkdown(text).trim();
    if (!plain) return [];
    var sentences = plain.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    var chunks = [];
    var current = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      if (current.length + s.length + (current ? 1 : 0) <= maxLen) {
        current = current ? current + ' ' + s : s;
      } else {
        if (current) chunks.push(current);
        if (s.length > maxLen) {
          while (s.length > maxLen) {
            chunks.push(s.slice(0, maxLen));
            s = s.slice(maxLen).trim();
          }
          current = s;
        } else {
          current = s;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  /** Create a single feed post or a thread (replies). Returns promise that resolves to { postUris }. */
  function postFeedTextOrThread(text) {
    var chunks = splitSentences(text, BSKY_POST_MAX);
    if (chunks.length === 0) return Promise.resolve({ postUris: [] });
    var now = new Date().toISOString();
    function makePost(txt, replyRef) {
      var rec = { $type: 'app.bsky.feed.post', text: txt, createdAt: now };
      if (replyRef) rec.reply = replyRef;
      return rec;
    }
    return createRecordToBluesky('app.bsky.feed.post', makePost(chunks[0], null))
      .then(function (first) {
        var uris = [first.uri];
        var root = { uri: first.uri, cid: first.cid };
        var parent = { uri: first.uri, cid: first.cid };
        var chain = Promise.resolve(first);
        for (var i = 1; i < chunks.length; i++) {
          (function (idx) {
            chain = chain.then(function (prev) {
              var ref = { root: root, parent: { uri: prev.uri, cid: prev.cid } };
              return createRecordToBluesky('app.bsky.feed.post', makePost(chunks[idx], ref));
            }).then(function (res) {
              uris.push(res.uri);
              return res;
            });
          })(i);
        }
        return chain.then(function () { return { postUris: uris }; });
      });
  }

  /** Build full plain text for feed (title + body) and post as one or thread. */
  function postContentAsFeed(title, body) {
    var full = (title ? title + '\n\n' : '') + (body || '');
    var text = full.trim() || 'Posted from blendsky';
    return postFeedTextOrThread(text);
  }

  var syncingWikiSlug = null;
  var syncingForumId = null;

  /** Full sync: put site.standard.document + post feed (single or thread). Updates page.atUri. */
  function doSyncWikiPage(slug) {
    var pages = getWikiPages();
    var page = pages[slug];
    if (!page || typeof StandardSite === 'undefined') return Promise.resolve();
    var session = getStoredSession();
    if (!session || !session.accessJwt) return Promise.resolve();
    syncingWikiSlug = slug;
    var baseUrl = typeof location !== 'undefined' ? location.origin : '';
    var record = StandardSite.documentFromWikiPage(page, slug, baseUrl);
    var rkey = sanitizeRkey(slug);
    return putRecordToBluesky(StandardSite.NS_DOCUMENT, rkey, record)
      .then(function (res) {
        page.atUri = res.uri;
        page.updatedAt = new Date().toISOString();
        return postContentAsFeed(page.title, page.body);
      })
      .then(function () {
        pages[slug] = page;
        setWikiPages(pages);
      })
      .catch(function (err) {
        if (err && err.message) console.error('Wiki sync:', err.message);
        throw err;
      })
      .then(function () { syncingWikiSlug = null; }, function () { syncingWikiSlug = null; });
  }

  /** Full sync: put site.standard.document + post feed (single or thread). Updates thread.atUri. */
  function doSyncForumThread(threadId) {
    var data = getForumData();
    var thread = data.threads.find(function (t) { return t.id === threadId; });
    if (!thread || typeof StandardSite === 'undefined') return Promise.resolve();
    var session = getStoredSession();
    if (!session || !session.accessJwt) return Promise.resolve();
    syncingForumId = threadId;
    var baseUrl = typeof location !== 'undefined' ? location.origin : '';
    var doc = StandardSite.documentFromThread(thread, baseUrl);
    var record = { $type: StandardSite.NS_DOCUMENT, ...doc, content: thread.body || '' };
    var rkey = sanitizeRkey(thread.path || 'thread-' + thread.id);
    return putRecordToBluesky(StandardSite.NS_DOCUMENT, rkey, record)
      .then(function (res) {
        thread.atUri = res.uri;
        thread.updatedAt = new Date().toISOString();
        return postContentAsFeed(thread.title, (thread.body || '') + '\n\n#blendsky-forum');
      })
      .then(function (result) {
        if (result && result.postUris && result.postUris[0]) thread.feedPostUri = result.postUris[0];
        setForumData(data);
      })
      .catch(function (err) {
        if (err && err.message) console.error('Forum sync:', err.message);
        throw err;
      })
      .then(function () { syncingForumId = null; }, function () { syncingForumId = null; });
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
            did: data.did,
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
