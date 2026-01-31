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

    var versionEl = document.getElementById('app-version');
    if (versionEl && config && config.version) versionEl.textContent = ' v' + String(config.version);

    (function () {
      'use strict';

  var STORAGE_WIKI = 'blendsky_wiki';
  var STORAGE_FORUM = 'blendsky_forum';
  var STORAGE_FORUM_VOTES = 'blendsky_forum_votes';
  var STORAGE_BSKY = 'blendsky_session';
  var DEFAULT_PDS = 'https://bsky.social';
  var APP_VIEW = 'https://api.bsky.app';
  var PUBLIC_APP_VIEW = 'https://public.api.bsky.app';
  var PLC_DIRECTORY = 'https://plc.directory';
  var CONSTELLATION_BASE = 'https://constellation.microcosm.blue';

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
      var session = getStoredSession();
      var homeFeedSection = document.getElementById('home-bluesky-section');
      if (homeFeedSection) {
        if (session && session.accessJwt) {
          homeFeedSection.classList.remove('hidden');
          loadHomeBlueskyFeed();
        } else {
          homeFeedSection.classList.add('hidden');
        }
      }
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

  function bskyProfileUrl(author) {
    if (!author) return 'https://bsky.app';
    var did = author.did || '';
    var handle = author.handle || '';
    return 'https://bsky.app/profile/' + encodeURIComponent(handle || did || '');
  }

  /** Search Bluesky posts by query. Uses PDS + auth when logged in (so results load); falls back to public API when not. */
  function searchPostsBluesky(q, limit) {
    var session = getStoredSession();
    var params = 'q=' + encodeURIComponent(q) + '&limit=' + (limit || 10) + '&sort=latest';
    var url;
    var opts = { method: 'GET' };
    if (session && session.accessJwt && session.pdsUrl) {
      url = session.pdsUrl.replace(/\/$/, '') + '/xrpc/app.bsky.feed.searchPosts?' + params;
      opts.headers = { Authorization: 'Bearer ' + session.accessJwt };
    } else {
      url = PUBLIC_APP_VIEW + '/xrpc/app.bsky.feed.searchPosts?' + params;
    }
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || r.statusText); });
      return r.json();
    });
  }

  function loadHomeRecent() {
    var wrap = document.getElementById('home-recent-feed');
    var descEl = document.getElementById('home-recent-desc');
    if (!wrap) return;
    var session = getStoredSession();
    var loadCommunity = function () {
      if (descEl) descEl.textContent = session && session.did
        ? 'Recent wiki and forum posts from the community. Author DID and Bluesky profile linked.'
        : 'Recent wiki and forum posts from the community (search #blendsky-forum and #blendsky-wiki on Bluesky).';
      wrap.innerHTML = '<p class="muted">Loading…</p>';
      return Promise.all([
        searchPostsBluesky('#blendsky-forum', 10).catch(function () { return { posts: [] }; }),
        searchPostsBluesky('#blendsky-wiki', 10).catch(function () { return { posts: [] }; })
      ])
        .then(function (results) {
          var forumPosts = (results[0] && results[0].posts) || (results[0] && results[0].feed) || [];
          var wikiPosts = (results[1] && results[1].posts) || (results[1] && results[1].feed) || [];
          forumPosts.forEach(function (p) { p._type = 'forum'; });
          wikiPosts.forEach(function (p) { p._type = 'wiki'; });
          var merged = forumPosts.concat(wikiPosts);
          merged.sort(function (a, b) {
            var ta = (a.record && a.record.createdAt) ? new Date(a.record.createdAt).getTime() : 0;
            var tb = (b.record && b.record.createdAt) ? new Date(b.record.createdAt).getTime() : 0;
            return tb - ta;
          });
          var slice = merged.slice(0, 14);
          if (slice.length === 0) {
            wrap.innerHTML = '<p class="muted">No wiki or forum posts from others yet. Sync your own from Wiki or Forum to join in.</p>';
            return;
          }
          wrap.innerHTML = slice.map(function (p) {
            var author = p.author || {};
            var handle = author.handle || author.did || '?';
            var did = author.did || '';
            var text = (p.record && p.record.text) ? String(p.record.text).slice(0, 140) : '';
            if (text.length === 140) text += '…';
            var postUrl = feedPostUriToBskyUrl(p.uri) || ('https://bsky.app/profile/' + encodeURIComponent(did) + '/post/' + (p.uri ? p.uri.split('/').pop() : ''));
            var profileUrl = bskyProfileUrl(author);
            var typeLabel = p._type === 'wiki' ? 'Wiki' : 'Forum';
            return (
              '<div class="home-recent-network-card">' +
                '<span class="home-recent-type">' + escapeHtml(typeLabel) + '</span>' +
                '<p class="home-recent-network-text">' + escapeHtml(text).replace(/\n/g, ' ') + '</p>' +
                '<p class="home-recent-network-author">' +
                  'By <a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener" class="home-recent-profile-link">@' + escapeHtml(handle) + '</a>' +
                  (did ? ' <span class="home-recent-did" title="' + escapeHtml(did) + '">DID: ' + escapeHtml(did.length > 28 ? did.slice(0, 20) + '…' : did) + '</span>' : '') +
                '</p>' +
                '<p class="home-recent-network-actions">' +
                  '<a href="' + escapeHtml(postUrl) + '" target="_blank" rel="noopener" class="home-recent-post-link">View post</a>' +
                '</p>' +
              '</div>'
            );
          }).join('');
        })
        .catch(function () {
          wrap.innerHTML = '<p class="muted">Could not load community posts. <a href="https://bsky.app/search?q=%23blendsky-forum" target="_blank" rel="noopener">Search #blendsky-forum</a> or <a href="https://bsky.app/search?q=%23blendsky-wiki" target="_blank" rel="noopener">#blendsky-wiki</a> on Bluesky.</p>';
        });
    };

    loadCommunity();
  }

  function loadDiscoverB3d() {
    var wrap = document.getElementById('home-discover-feed');
    var loading = document.getElementById('home-discover-loading');
    if (!wrap || !loading) return;
    searchPostsBluesky('#b3d', 12)
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
          var text = (p.record && p.record.text) ? String(p.record.text).slice(0, 120) : '';
          if (text.length === 120) text += '…';
          var postUri = p.uri ? feedPostUriToBskyUrl(p.uri) : ('https://bsky.app/profile/' + (author.did || (p.uri && p.uri.split('/')[2]) || '') + '/post/' + (p.uri ? p.uri.split('/').pop() : ''));
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

  var homeFeedCursor = null;
  function loadHomeBlueskyFeed(append) {
    var wrap = document.getElementById('home-bluesky-feed');
    if (!wrap) return;
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return;
    var url = session.pdsUrl.replace(/\/$/, '') + '/xrpc/app.bsky.feed.getTimeline?limit=20';
    if (append && homeFeedCursor) url += '&cursor=' + encodeURIComponent(homeFeedCursor);
    fetch(url, { headers: { Authorization: 'Bearer ' + session.accessJwt } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var items = (data && data.feed) || [];
        homeFeedCursor = data && data.cursor ? data.cursor : null;
        var loadMoreBtn = document.getElementById('home-bluesky-load-more');
        if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !homeFeedCursor);
        if (!append) wrap.innerHTML = '';
        items.forEach(function (item) {
          var post = item.post || item;
          var uri = post.uri;
          var bskyUrl = uri ? feedPostUriToBskyUrl(uri) : null;
          if (!bskyUrl) return;
          var cell = document.createElement('div');
          cell.className = 'bsky-post-embed';
          cell.dataset.embedUrl = bskyUrl;
          wrap.appendChild(cell);
          fetch('https://embed.bsky.app/oembed?url=' + encodeURIComponent(bskyUrl) + '&format=json&maxwidth=600')
            .then(function (r) { return r.json(); })
            .then(function (oembed) {
              if (oembed && oembed.html) {
                cell.innerHTML = oembed.html;
                var scripts = cell.querySelectorAll('script');
                scripts.forEach(function (s) {
                  var ns = document.createElement('script');
                  if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
                  document.body.appendChild(ns);
                });
              } else {
                var author = post.author || {};
                var handle = author.handle || author.did || '?';
                var text = (post.record && post.record.text) ? String(post.record.text).slice(0, 200) : '';
                cell.innerHTML = '<p class="muted"><a href="' + escapeHtml(bskyUrl) + '" target="_blank" rel="noopener">@' + escapeHtml(handle) + '</a>: ' + escapeHtml(text) + '…</p>';
              }
            })
            .catch(function () {
              var author = post.author || {};
              var handle = author.handle || author.did || '?';
              var text = (post.record && post.record.text) ? String(post.record.text).slice(0, 200) : '';
              cell.innerHTML = '<p class="muted"><a href="' + (uri ? feedPostUriToBskyUrl(uri) : '#') + '" target="_blank" rel="noopener">@' + escapeHtml(handle) + '</a>: ' + escapeHtml(text) + '…</p>';
            });
        });
      })
      .catch(function () { if (!append) wrap.innerHTML = '<p class="muted">Could not load feed.</p>'; });
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
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="user-content-img" loading="lazy" referrerpolicy="no-referrer" />');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/(https?:\/\/[^\s<>"']+\.(?:jpe?g|png|gif|webp))(?![\w])/gi, '<img src="$1" alt="" class="user-content-img" loading="lazy" referrerpolicy="no-referrer" />');
    html = html.replace(/(https?:\/\/[^\s<>"']*getBlob[^\s<>"']*(?:&(?:amp;)?[^\s<>"']*)*)/gi, '<img src="$1" alt="" class="user-content-img" loading="lazy" referrerpolicy="no-referrer" />');
    return html;
  }

  /** Turn body text into HTML with markdown and images (wiki and forum). */
  function bodyToHtml(body) {
    if (!body) return '';
    return simpleMarkdown(body);
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
    loadWikiFromOthers();
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

  function loadWikiFromOthers() {
    var wrap = document.getElementById('wiki-from-others-feed');
    var loading = document.getElementById('wiki-from-others-loading');
    if (!wrap || !loading) return;
    var constellationPromise = fetchConstellationLinks(window.location.origin, 'site.standard.document', '.path', 40).then(function (links) {
      return Promise.all(links.slice(0, 25).map(function (l) {
        return fetchAtRecord(l.uri).then(function (data) {
          var record = data.value || data.record;
          var path = (record && record.path) ? String(record.path) : '';
          if (!record || path.indexOf('/wiki/') !== 0) return null;
          var title = (record && record.title) || 'Untitled';
          var content = (record && (record.content || record.textContent)) || '';
          var snippet = String(content).replace(/\n/g, ' ').slice(0, 140);
          if (snippet.length === 140) snippet += '…';
          var sortAt = new Date(record.publishedAt || record.updatedAt || 0).getTime();
          return { _type: 'lexicon', uri: l.uri, did: l.did, title: title, snippet: snippet, sortAt: sortAt };
        }).catch(function () { return null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    }).catch(function () { return []; });
    var wikiSearchPromise = searchPostsBluesky('#blendsky-wiki', 25).then(function (data) {
      var posts = (data && data.posts) || (data && data.feed) || [];
      return posts.map(function (p) {
        var author = p.author || {};
        var text = (p.record && p.record.text) ? String(p.record.text) : '';
        var firstLine = text.split('\n')[0] || text;
        var title = firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
        var snippet = text.replace(/\n/g, ' ').slice(0, 140);
        if (snippet.length === 140) snippet += '…';
        var sortAt = new Date((p.record && p.record.createdAt) || 0).getTime();
        var postUrl = p.uri ? feedPostUriToBskyUrl(p.uri) : ('https://bsky.app/profile/' + (author.did || '') + '/post/' + (p.uri ? p.uri.split('/').pop() : ''));
        return { _type: 'feed', did: author.did, handle: author.handle || author.did || '?', title: title || 'Wiki post', snippet: snippet, sortAt: sortAt, postUrl: postUrl };
      });
    }).catch(function () { return []; });
    Promise.all([constellationPromise, wikiSearchPromise]).then(function (results) {
      var lexiconCards = results[0];
      var feedCards = results[1];
      var items = [];
      lexiconCards.forEach(function (c) { items.push({ sortAt: c.sortAt, _type: 'lexicon', c: c }); });
      feedCards.forEach(function (c) { items.push({ sortAt: c.sortAt, _type: 'feed', c: c }); });
      items.sort(function (a, b) { return (b.sortAt || 0) - (a.sortAt || 0); });
      loading.classList.add('hidden');
      if (items.length === 0) {
        wrap.innerHTML = '<p class="muted">No wiki articles from others yet. Sync a page to Bluesky (uses Standard.site <code>site.standard.document</code>).</p>';
        return;
      }
      var profilePromises = items.filter(function (i) { return i._type === 'lexicon'; }).map(function (i) { return getProfileByDid(i.c.did).then(function (p) { i.c.profile = p; return i; }); });
      Promise.all(profilePromises).then(function () {
        wrap.innerHTML = items.map(function (item) {
          if (item._type === 'lexicon') {
            var c = item.c;
            var profile = c.profile || {};
            var handle = profile.handle || c.did || '?';
            var profileUrl = 'https://bsky.app/profile/' + encodeURIComponent(handle || c.did);
            return (
              '<div class="wiki-from-others-card" data-wiki-uri="' + escapeHtml(c.uri) + '">' +
                '<a href="#" class="wiki-from-others-card-link wiki-from-others-card-lexicon" title="Click to copy AT URI; paste in Forum import to open">' +
                  '<strong class="wiki-from-others-title">' + escapeHtml(c.title) + '</strong>' +
                  '<p class="wiki-from-others-text">' + escapeHtml(c.snippet).replace(/\n/g, ' ') + '</p>' +
                '</a>' +
                '<p class="wiki-from-others-author">' +
                  'By <a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">@' + escapeHtml(handle) + '</a>' +
                  (c.did ? ' <span class="wiki-from-others-did" title="' + escapeHtml(c.did) + '">DID: ' + escapeHtml(c.did.length > 28 ? c.did.slice(0, 20) + '…' : c.did) + '</span>' : '') +
                '</p>' +
              '</div>'
            );
          }
          var c = item.c;
          var profileUrl = 'https://bsky.app/profile/' + encodeURIComponent(c.handle || c.did || '');
          return (
            '<div class="wiki-from-others-card">' +
              '<a href="' + escapeHtml(c.postUrl) + '" target="_blank" rel="noopener" class="wiki-from-others-card-link">' +
                '<strong class="wiki-from-others-title">' + escapeHtml(c.title) + '</strong>' +
                '<p class="wiki-from-others-text">' + escapeHtml(c.snippet).replace(/\n/g, ' ') + '</p>' +
              '</a>' +
              '<p class="wiki-from-others-author">' +
                'By <a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener">@' + escapeHtml(c.handle) + '</a>' +
                (c.did ? ' <span class="wiki-from-others-did" title="' + escapeHtml(c.did) + '">DID: ' + escapeHtml(c.did.length > 28 ? c.did.slice(0, 20) + '…' : c.did) + '</span>' : '') +
              '</p>' +
            '</div>'
          );
        }).join('');
        wrap.querySelectorAll('.wiki-from-others-card-lexicon').forEach(function (a) {
          var card = a.closest('.wiki-from-others-card');
          var uri = card && card.getAttribute('data-wiki-uri');
          if (!uri) return;
          a.addEventListener('click', function (e) {
            e.preventDefault();
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(uri).then(function () {
                var t = a.querySelector('.wiki-from-others-title');
                if (t) { var orig = t.textContent; t.textContent = 'Copied! Paste in Forum import.'; setTimeout(function () { t.textContent = orig; }, 1500); }
              });
            } else {
              prompt('AT URI (paste in Forum import):', uri);
            }
          });
        });
      });
    }).catch(function () {
      loading.classList.add('hidden');
      wrap.innerHTML = '<p class="muted">Could not load wiki articles. Sync a page to Bluesky (Standard.site <code>site.standard.document</code>).</p>';
    });
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
    if (session && session.accessJwt && typeof BlendskyLexicon !== 'undefined') {
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
    if (typeof BlendskyLexicon === 'undefined') {
      alert('Blendsky lexicon script not loaded. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to load the latest code. If the problem continues, ensure blendsky-lexicon.js is in the same folder as this page.');
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

  function getForumVotes() {
    try {
      var raw = localStorage.getItem(STORAGE_FORUM_VOTES);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }
  function setForumVotes(votes) {
    localStorage.setItem(STORAGE_FORUM_VOTES, JSON.stringify(votes));
  }
  function getThreadVote(threadId) {
    var votes = getForumVotes();
    var v = votes['t' + threadId];
    return v === 1 ? 1 : v === -1 ? -1 : 0;
  }
  function setThreadVote(threadId, value) {
    var votes = getForumVotes();
    votes['t' + threadId] = value;
    setForumVotes(votes);
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
              var vote = getThreadVote(t.id);
              var score = (t.score !== undefined ? t.score : 0) + (vote === 1 ? 1 : vote === -1 ? -1 : 0);
              var status = syncingForumId === t.id ? 'syncing' : (t.atUri ? 'synced' : 'local');
              var badge = '<span class="sync-badge sync-' + status + '">' + (status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced' : 'Local') + '</span>';
              return (
                '<div class="forum-thread-row" data-thread-id="' + t.id + '">' +
                  '<div class="forum-vote-col">' +
                    '<button type="button" class="forum-vote-btn forum-vote-up" aria-label="Upvote" title="Upvote">▲</button>' +
                    '<span class="forum-vote-score">' + score + '</span>' +
                    '<button type="button" class="forum-vote-btn forum-vote-down" aria-label="Downvote" title="Downvote">▼</button>' +
                  '</div>' +
                  '<a href="#" class="forum-thread-card">' +
                    '<h3>' + escapeHtml(t.title) + '</h3>' +
                    '<span class="meta">' + escapeHtml(t.author || 'Anonymous') + ' · ' + (t.replies ? t.replies.length : 0) + ' replies</span> ' +
                    badge +
                  '</a>' +
                '</div>'
              );
            })
            .join('');
    list.querySelectorAll('.forum-thread-row').forEach(function (row) {
      var threadId = Number(row.getAttribute('data-thread-id'));
      var card = row.querySelector('.forum-thread-card');
      if (card) {
        card.addEventListener('click', function (e) {
          e.preventDefault();
          openThread(threadId);
        });
      }
      var upBtn = row.querySelector('.forum-vote-up');
      var downBtn = row.querySelector('.forum-vote-down');
      var scoreEl = row.querySelector('.forum-vote-score');
      function updateVote() {
        var v = getThreadVote(threadId);
        setThreadVote(threadId, v === 1 ? 0 : 1);
        renderThreadList();
      }
      function updateDown() {
        var v = getThreadVote(threadId);
        setThreadVote(threadId, v === -1 ? 0 : -1);
        renderThreadList();
      }
      if (upBtn) upBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); updateVote(); });
      if (downBtn) downBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); updateDown(); });
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
    var vote = getThreadVote(id);
    var score = (thread.score !== undefined ? thread.score : 0) + (vote === 1 ? 1 : vote === -1 ? -1 : 0);
    var body = '<div class="forum-thread-detail-header">' +
      '<div class="forum-vote-col forum-vote-col-detail">' +
        '<button type="button" class="forum-vote-btn forum-vote-up" data-thread-id="' + id + '" aria-label="Upvote">▲</button>' +
        '<span class="forum-vote-score">' + score + '</span>' +
        '<button type="button" class="forum-vote-btn forum-vote-down" data-thread-id="' + id + '" aria-label="Downvote">▼</button>' +
      '</div>' +
      '<div class="forum-thread-detail-main">' +
        '<h2>' + escapeHtml(thread.title) + '</h2><p class="meta">' + meta + '</p><p class="sync-status sync-' + (thread.atUri ? 'synced' : 'local') + '" id="forum-thread-sync-status">' + escapeHtml(threadStatus) + '</p>';
    if (thread.description) {
      body += '<p class="forum-description">' + escapeHtml(thread.description) + '</p>';
    }
    body += '<div class="forum-reply text forum-body-html">' + bodyToHtml(thread.body || '') + '</div>';
    if (thread.atUri) {
      body += '<p class="forum-at-uri muted"><small>Document: <a href="' + escapeHtml(thread.atUri) + '" target="_blank" rel="noopener">' + escapeHtml(thread.atUri) + '</a></small></p>';
    }
    var replyPostUrl = thread.feedPostUri ? feedPostUriToBskyUrl(thread.feedPostUri) : null;
    if (replyPostUrl) {
      body += '<p class="forum-view-on-bluesky muted"><small><a href="' + escapeHtml(replyPostUrl) + '" target="_blank" rel="noopener">View on Bluesky</a></small></p>';
    }
    body += '</div></div>';
    detail.innerHTML = body;
    detail.querySelectorAll('.forum-vote-btn[data-thread-id]').forEach(function (btn) {
      var tid = Number(btn.getAttribute('data-thread-id'));
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var v = getThreadVote(tid);
        setThreadVote(tid, btn.classList.contains('forum-vote-up') ? (v === 1 ? 0 : 1) : (v === -1 ? 0 : -1));
        openThread(tid);
      });
    });
    const repliesList = document.getElementById('forum-replies-list');
    repliesList.innerHTML = (thread.replies || [])
      .map(function (r) {
        return (
          '<li class="forum-reply"><span class="author">' +
          escapeHtml(r.author || 'Anonymous') +
          '</span><div class="text">' +
          bodyToHtml(r.text) +
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

  function insertImageIntoBody(textareaId, blobUrl) {
    var ta = document.getElementById(textareaId);
    if (!ta) return;
    var insert = '\n\n![image](' + blobUrl + ')\n\n';
    var start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
    var end = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    ta.focus();
  }

  document.getElementById('forum-new-image').addEventListener('change', function () {
    var input = this;
    var file = input.files && input.files[0];
    if (!file) return;
    var session = getStoredSession();
    if (!session || !session.accessJwt) {
      alert('Connect your Bluesky account first (Bluesky tab) to upload images.');
      input.value = '';
      return;
    }
    uploadBlobToBluesky(file).then(function (blobUrl) {
      insertImageIntoBody('forum-new-body', blobUrl);
    }).catch(function (err) {
      alert('Upload failed: ' + (err.message || 'unknown'));
    }).then(function () { input.value = ''; });
  });

  document.getElementById('forum-edit-image').addEventListener('change', function () {
    var input = this;
    var file = input.files && input.files[0];
    if (!file) return;
    var session = getStoredSession();
    if (!session || !session.accessJwt) {
      alert('Connect your Bluesky account first (Bluesky tab) to upload images.');
      input.value = '';
      return;
    }
    uploadBlobToBluesky(file).then(function (blobUrl) {
      insertImageIntoBody('forum-edit-body', blobUrl);
    }).catch(function (err) {
      alert('Upload failed: ' + (err.message || 'unknown'));
    }).then(function () { input.value = ''; });
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
    if (session && session.accessJwt && typeof BlendskyLexicon !== 'undefined') {
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
    if (session && session.accessJwt && typeof BlendskyLexicon !== 'undefined') {
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

  document.getElementById('forum-reply-image').addEventListener('change', function () {
    var input = this;
    var file = input.files && input.files[0];
    if (!file) return;
    var session = getStoredSession();
    if (!session || !session.accessJwt) {
      alert('Connect your Bluesky account first (Bluesky tab) to upload images.');
      input.value = '';
      return;
    }
    uploadBlobToBluesky(file).then(function (blobUrl) {
      insertImageIntoBody('forum-reply-body', blobUrl);
    }).catch(function (err) {
      alert('Upload failed: ' + (err.message || 'unknown'));
    }).then(function () { input.value = ''; });
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
    if (id == null || !thread || typeof BlendskyLexicon === 'undefined') return;
    const baseUrl = typeof location !== 'undefined' ? location.origin : '';
    const doc = BlendskyLexicon.documentFromThread(thread, baseUrl);
    const json = JSON.stringify(doc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (thread.path || 'thread-' + id) + '.blendsky.json';
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
    if (typeof BlendskyLexicon === 'undefined') {
      alert('Blendsky lexicon script not loaded. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to load the latest code. If the problem continues, ensure blendsky-lexicon.js is in the same folder as this page.');
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

  /** Resolve a /b/handle/slug URL to an at:// URI. Returns a promise that resolves to the at URI. */
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
          var ns = typeof BlendskyLexicon !== 'undefined' ? BlendskyLexicon.NS_DOCUMENT : 'site.standard.document';
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
      return Promise.reject(new Error('URL format not recognized. Use an at:// URI or a /b/handle/slug URL.'));
    } catch (e) {
      return Promise.reject(e.message ? new Error(e.message) : e);
    }
  }

  /** Import a document by AT URI and open it in the forum (or open existing if already imported). Returns Promise. */
  function doImportAndOpen(uri) {
    var forumData = getForumData();
    var existing = forumData.threads.find(function (t) { return t.atUri === uri; });
    if (existing) {
      openThread(existing.id);
      return Promise.resolve();
    }
    var req = API
      ? fetch(API + '/api/at/record?uri=' + encodeURIComponent(uri), { credentials: 'include' }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
      : fetchAtRecord(uri);
    return req.then(function (data) {
      if (typeof BlendskyLexicon === 'undefined') throw new Error('BlendskyLexicon not loaded');
      var record = data.value || data.record || data;
      var author = data.handle || (data.repo && data.repo.indexOf('did:') === 0 ? 'AT' : '');
      var thread = BlendskyLexicon.recordToThread(record, uri, author);
      if (!thread) throw new Error('Could not parse document');
      var fd = getForumData();
      var newId = fd.nextId++;
      thread.id = newId;
      fd.threads.push(thread);
      setForumData(fd);
      renderThreadList();
      openThread(newId);
    });
  }

  /** Remix: fetch document by AT URI, create a new thread with the content (and "Remixed from" line), open in edit mode so user can adapt and sync. Returns Promise. */
  function doRemixFromUri(uri) {
    var req = API
      ? fetch(API + '/api/at/record?uri=' + encodeURIComponent(uri), { credentials: 'include' }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
      : fetchAtRecord(uri);
    return req.then(function (data) {
      if (typeof BlendskyLexicon === 'undefined') throw new Error('BlendskyLexicon not loaded');
      var record = data.value || data.record || data;
      var author = data.handle || (data.repo && data.repo.indexOf('did:') === 0 ? 'AT' : '');
      var imported = BlendskyLexicon.recordToThread(record, uri, author);
      if (!imported) throw new Error('Could not parse document');
      var fd = getForumData();
      var newId = fd.nextId++;
      var now = new Date().toISOString();
      var body = 'Remixed from: ' + uri + '\n\n' + (imported.body || '');
      var pathSeg = (imported.path || '').replace(/^forum\/?/, '');
      var newThread = {
        id: newId,
        title: (imported.title || 'Untitled') + ' (remix)',
        body: body,
        description: imported.description || '',
        path: pathSeg ? pathSeg + '-remix' : undefined,
        tags: imported.tags,
        publishedAt: now,
        updatedAt: now,
        author: 'You',
        replies: [],
        remixedFrom: uri
      };
      fd.threads.push(newThread);
      setForumData(fd);
      renderThreadList();
      document.getElementById('forum-thread-list').classList.remove('hidden');
      document.getElementById('forum-thread-view').classList.add('hidden');
      document.getElementById('forum-new-view').classList.add('hidden');
      document.getElementById('forum-edit-view').classList.remove('hidden');
      document.getElementById('forum-edit-view').dataset.editingThreadId = String(newId);
      document.getElementById('forum-edit-title').value = newThread.title;
      document.getElementById('forum-edit-path').value = newThread.path || '';
      document.getElementById('forum-edit-description').value = newThread.description || '';
      document.getElementById('forum-edit-body').value = newThread.body || '';
      document.getElementById('forum-edit-tags').value = (newThread.tags && newThread.tags.length) ? newThread.tags.join(', ') : '';
    });
  }

  document.getElementById('forum-import-btn').addEventListener('click', function () {
    var uriInput = document.getElementById('forum-import-uri');
    var raw = (uriInput && uriInput.value && uriInput.value.trim()) || '';
    if (!raw) {
      alert('Enter an AT URI (at://did:plc:…/site.standard.document/…) or a /b/handle/slug URL.');
      return;
    }
    var atUriPromise = (raw.indexOf('at://') === 0)
      ? Promise.resolve(raw)
      : resolveUrlToAtUri(raw);
    atUriPromise.then(function (uri) {
      return doImportAndOpen(uri).then(function () {
        if (uriInput) uriInput.value = '';
      });
    }).catch(function (err) {
      alert('Import failed: ' + (err.message || 'unknown'));
    });
  });

  /** Fetch DIDs that link to target (e.g. site.standard.document records). Returns Promise<{ uri, did }[]>. */
  function fetchConstellationLinks(targetOrigin, collection, path, limit) {
    var url = CONSTELLATION_BASE + '/links?target=' + encodeURIComponent(targetOrigin) + '&collection=' + encodeURIComponent(collection || 'site.standard.document') + '&path=' + encodeURIComponent(path || '.path') + '&limit=' + (limit || 30);
    return fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'blendsky/1.0' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var links = (data && data.links) || (data && data.sources) || (data && data.records) || (Array.isArray(data) ? data : []);
        return links.map(function (l) {
          var uri = (l && (l.source_uri || l.uri || (l.source && l.source.uri) || (l.source && l.source.record_uri))) || (typeof l === 'string' ? l : '');
          var did = (uri && uri.indexOf('at://') === 0) ? uri.split('/')[2] : '';
          return { uri: uri, did: did };
        }).filter(function (x) { return x.uri && x.uri.indexOf('at://') === 0; });
      })
      .catch(function () { return []; });
  }

  /** Fetch profile (handle, displayName, avatar) by DID from public API. */
  function getProfileByDid(did) {
    if (!did) return Promise.resolve(null);
    var url = PUBLIC_APP_VIEW + '/xrpc/app.bsky.actor.getProfile?actor=' + encodeURIComponent(did);
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function loadForumDiscover() {
    var wrap = document.getElementById('forum-discover-feed');
    if (!wrap) return;
    wrap.innerHTML = '<p class="muted" id="forum-discover-loading">Loading…</p>';
    var loading = document.getElementById('forum-discover-loading');
    // Discovery: site.standard.document (Constellation) + Bluesky search #blendsky-forum. Merge and sort by latest so all accounts see each other's posts.
    var lexiconPromise = fetchConstellationLinks(window.location.origin, 'site.standard.document', '.path', 50).then(function (links) {
      return Promise.all(links.slice(0, 30).map(function (l) {
        return fetchAtRecord(l.uri).then(function (data) {
          var record = data.value || data.record;
          var path = (record && record.path) ? String(record.path) : '';
          if (!record || path.indexOf('/forum/') !== 0) return null;
          var title = (record && record.title) || 'Untitled';
          var content = (record && (record.content || record.textContent)) || '';
          var snippet = String(content).replace(/\n/g, ' ').slice(0, 160);
          if (snippet.length === 160) snippet += '…';
          var sortAt = new Date(record.publishedAt || record.updatedAt || 0).getTime();
          return { _type: 'lexicon', uri: l.uri, did: l.did, title: title, snippet: snippet, sortAt: sortAt };
        }).catch(function () { return null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    });
    var feedPromise = searchPostsBluesky('#blendsky-forum', 25).then(function (data) {
      var posts = (data && data.posts) || (data && data.feed) || [];
      return { cards: posts.map(function (p) {
        var text = (p.record && p.record.text) ? String(p.record.text).slice(0, 160) : '';
        if (text.length === 160) text += '…';
        var sortAt = new Date((p.record && p.record.createdAt) || 0).getTime();
        return { _type: 'feed', post: p, snippet: text, sortAt: sortAt };
      }), searchFailed: false };
    }).catch(function (err) {
      return { cards: [], searchFailed: true };
    });
    Promise.all([lexiconPromise, feedPromise]).then(function (results) {
      var lexiconCards = results[0];
      var feedResult = results[1];
      var feedCards = feedResult.cards || [];
      var searchFailed = feedResult.searchFailed === true;
      loading.classList.add('hidden');
      var profilePromises = lexiconCards.map(function (c) { return getProfileByDid(c.did).then(function (p) { c.profile = p; return c; }); });
      Promise.all(profilePromises).then(function () {
        var items = [];
        lexiconCards.forEach(function (c) { items.push({ sortAt: c.sortAt, _type: 'lexicon', c: c }); });
        feedCards.forEach(function (c) { items.push({ sortAt: c.sortAt, _type: 'feed', c: c }); });
        items.sort(function (a, b) { return (b.sortAt || 0) - (a.sortAt || 0); });
        var parts = [];
        items.forEach(function (item) {
          if (item._type === 'lexicon') {
            var c = item.c;
            var profile = c.profile || {};
            var handle = profile.handle || c.did || '?';
            var displayName = profile.displayName || handle;
            var avatarUrl = profile.avatar || '';
            var profileUrl = 'https://bsky.app/profile/' + encodeURIComponent(handle || c.did);
            var avatarHtml = avatarUrl
              ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" class="forum-discover-avatar" loading="lazy" />'
              : '<span class="forum-discover-avatar forum-discover-avatar-placeholder" aria-hidden="true">' + escapeHtml((displayName || '?').charAt(0).toUpperCase()) + '</span>';
            parts.push(
              '<div class="forum-discover-card-wrap" data-lexicon-uri="' + escapeHtml(c.uri) + '">' +
                '<a href="#" class="forum-discover-card forum-discover-card-lexicon" title="Click to open this thread">' +
                  '<div class="forum-discover-byline">' +
                    avatarHtml +
                    '<span class="forum-discover-name">' + escapeHtml(c.title) + '</span>' +
                    '<span class="forum-discover-handle">@' + escapeHtml(handle) + '</span>' +
                  '</div>' +
                  '<p class="discover-text">' + escapeHtml(c.snippet).replace(/\n/g, ' ') + '</p>' +
                '</a>' +
                '<p class="forum-discover-author-meta">' +
                  (c.did ? '<span class="forum-discover-did" title="' + escapeHtml(c.did) + '">DID: ' + escapeHtml(c.did.length > 28 ? c.did.slice(0, 20) + '…' : c.did) + '</span> ' : '') +
                  '<a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener" class="forum-discover-profile-link">Bluesky profile</a> · ' +
                  '<span class="forum-discover-lexicon-tag">site.standard.document</span>' +
                '</p>' +
                '<p class="forum-discover-actions">' +
                  '<button type="button" class="btn btn-ghost btn-sm forum-discover-remix-btn" title="Copy into a new thread and edit (remix tutorial)">Remix</button>' +
                '</p>' +
              '</div>'
            );
          } else {
            var c = item.c;
            var p = c.post;
            var author = p.author || {};
            var handle = author.handle || author.did || '?';
            var displayName = author.displayName || handle;
            var did = author.did || '';
            var avatarUrl = author.avatar || '';
            var postUri = p.uri ? feedPostUriToBskyUrl(p.uri) : ('https://bsky.app/profile/' + (did || '') + '/post/' + (p.uri ? p.uri.split('/').pop() : ''));
            var profileUrl = bskyProfileUrl(author);
            var avatarHtml = avatarUrl
              ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" class="forum-discover-avatar" loading="lazy" />'
              : '<span class="forum-discover-avatar forum-discover-avatar-placeholder" aria-hidden="true">' + escapeHtml((displayName || '?').charAt(0).toUpperCase()) + '</span>';
            parts.push(
              '<div class="forum-discover-card-wrap">' +
                '<a href="' + escapeHtml(postUri) + '" target="_blank" rel="noopener" class="forum-discover-card">' +
                  '<div class="forum-discover-byline">' +
                    avatarHtml +
                    '<span class="forum-discover-name">' + escapeHtml(displayName) + '</span>' +
                    '<span class="forum-discover-handle">@' + escapeHtml(handle) + '</span>' +
                  '</div>' +
                  '<p class="discover-text">' + escapeHtml(c.snippet).replace(/\n/g, ' ') + '</p>' +
                '</a>' +
                '<p class="forum-discover-author-meta">' +
                  (did ? '<span class="forum-discover-did" title="' + escapeHtml(did) + '">DID: ' + escapeHtml(did.length > 32 ? did.slice(0, 24) + '…' : did) + '</span> ' : '') +
                  '<a href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener" class="forum-discover-profile-link">Bluesky profile</a>' +
                '</p>' +
              '</div>'
            );
          }
        });
        if (parts.length === 0) {
          var session = getStoredSession();
          var needLogin = !session || !session.accessJwt;
          var msg = needLogin && searchFailed
            ? 'Connect your Bluesky account to see forum posts from other users. Use <strong>Log in</strong> (top right), then click <strong>Refresh</strong> below to load community posts.'
            : needLogin
              ? 'Connect your Bluesky account (Log in, top right) to see forum posts from other users. After connecting, click Refresh below.'
              : 'No forum posts from others yet. Sync your thread to Bluesky (Standard.site <code>site.standard.document</code>). Or paste an AT URI below to import a thread.';
          wrap.innerHTML = '<p class="muted forum-discover-empty">' + msg + '</p><p class="forum-discover-refresh-wrap"><button type="button" class="btn btn-ghost forum-discover-refresh" id="forum-discover-refresh">Refresh community posts</button></p>';
          var refreshBtn = wrap.querySelector('#forum-discover-refresh');
          if (refreshBtn) refreshBtn.addEventListener('click', function () { loadForumDiscover(); });
          return;
        }
        wrap.innerHTML = parts.join('');
        wrap.querySelectorAll('.forum-discover-card-lexicon').forEach(function (a) {
          var wrapEl = a.closest('.forum-discover-card-wrap');
          var uri = wrapEl && wrapEl.getAttribute('data-lexicon-uri');
          if (!uri) return;
          a.addEventListener('click', function (e) {
            e.preventDefault();
            wrapEl.classList.add('forum-discover-loading');
            a.setAttribute('aria-busy', 'true');
            doImportAndOpen(uri).then(function () {
              wrapEl.classList.remove('forum-discover-loading');
              a.removeAttribute('aria-busy');
            }).catch(function (err) {
              wrapEl.classList.remove('forum-discover-loading');
              a.removeAttribute('aria-busy');
              alert('Import failed: ' + (err.message || 'unknown'));
            });
          });
        });
        wrap.querySelectorAll('.forum-discover-remix-btn').forEach(function (btn) {
          var wrapEl = btn.closest('.forum-discover-card-wrap');
          var uri = wrapEl && wrapEl.getAttribute('data-lexicon-uri');
          if (!uri) return;
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            wrapEl.classList.add('forum-discover-loading');
            btn.setAttribute('aria-busy', 'true');
            doRemixFromUri(uri).then(function () {
              wrapEl.classList.remove('forum-discover-loading');
              btn.removeAttribute('aria-busy');
            }).catch(function (err) {
              wrapEl.classList.remove('forum-discover-loading');
              btn.removeAttribute('aria-busy');
              alert('Remix failed: ' + (err.message || 'unknown'));
            });
          });
        });
      });
    }).catch(function () {
      loading.classList.add('hidden');
      var session = getStoredSession();
      wrap.innerHTML = '<p class="muted forum-discover-empty">Could not load community posts. ' +
        (session && session.accessJwt
          ? 'Click <strong>Refresh</strong> above to try again, or <a href="https://bsky.app/search?q=%23blendsky-forum" target="_blank" rel="noopener">search #blendsky-forum on Bluesky</a>.'
          : 'Connect your Bluesky account (Log in, top right) to see forum posts from other users, then click Refresh.') +
        ' Or paste an AT URI below to import a thread.</p>';
    });
  }

  function initForum() {
    renderThreadList();
    loadForumDiscover();
  }

  var forumDiscoverRefreshBtn = document.getElementById('forum-discover-refresh-btn');
  if (forumDiscoverRefreshBtn) forumDiscoverRefreshBtn.addEventListener('click', function () { loadForumDiscover(); });

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

  /** Refresh session using refreshJwt. Updates stored session; returns Promise<session>. */
  function refreshSession() {
    var session = getStoredSession();
    if (!session || !session.refreshJwt || !session.pdsUrl) return Promise.reject(new Error('No refresh token. Please log in again.'));
    var url = session.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.server.refreshSession';
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.refreshJwt }
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (err) { throw new Error(err.message || err.error || res.statusText); }).catch(function (e) { if (e instanceof Error && e.message) throw e; throw new Error(res.status + ' ' + res.statusText); });
      return res.json();
    }).then(function (data) {
      var newSession = {
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
        handle: data.handle || session.handle,
        did: data.did || session.did,
        pdsUrl: session.pdsUrl
      };
      setStoredSession(newSession);
      return newSession;
    });
  }

  var BSKY_POST_MAX = 300;

  /** Put a record (with rkey) into the logged-in user's Bluesky repo. Refreshes session on 401/ExpiredToken and retries once. */
  function putRecordToBluesky(collection, rkey, record) {
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected to Bluesky'));
    function doPut(s) {
      var url = s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.putRecord';
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.accessJwt },
        body: JSON.stringify({ repo: s.did, collection: collection, rkey: rkey, record: record })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            var msg = (err && (err.message || err.error)) || res.statusText;
            if (err && err.error) msg = (err.error + (err.message ? ': ' + err.message : ''));
            var e = new Error(msg);
            if (res.status === 401 || (err && (err.error === 'ExpiredToken' || (err.message && err.message.indexOf('expired') !== -1)))) e._expired = true;
            throw e;
          }).catch(function (parseErr) {
            if (parseErr._expired) throw parseErr;
            if (parseErr instanceof Error && parseErr.message && parseErr.message.indexOf('Unexpected') === -1) throw parseErr;
            throw new Error(res.status + ' ' + res.statusText);
          });
        }
        return res.json();
      });
    }
    return ensureSessionDid(session).then(function (s) {
      return doPut(s).catch(function (err) {
        if ((err && err._expired) || (err && (err.message && (err.message.indexOf('ExpiredToken') !== -1 || err.message.indexOf('expired') !== -1)))) {
          return refreshSession().then(function (newS) { return doPut(newS); });
        }
        throw err;
      });
    });
  }

  /** Upload an image blob to the user's repo. Returns a URL that can be embedded in content (getBlob). Refreshes session on 401/ExpiredToken and retries once. */
  function uploadBlobToBluesky(file) {
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected to Bluesky'));
    function doUpload(s) {
      var url = s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.uploadBlob';
      return fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + s.accessJwt, 'Content-Type': file.type || 'image/jpeg' },
        body: file
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw new Error(err.message || err.error || res.statusText); }).catch(function (e) { throw new Error(res.status + ' ' + res.statusText); });
        return res.json();
      }).then(function (data) {
        var ref = (data && data.blob && data.blob.ref) ? data.blob.ref : data.ref;
        var cid = (ref && ref.$link) ? ref.$link : (ref && ref.cid) ? ref.cid : null;
        if (!cid) throw new Error('No blob ref returned');
        return s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.sync.getBlob?did=' + encodeURIComponent(s.did) + '&cid=' + encodeURIComponent(cid);
      });
    }
    return ensureSessionDid(session).then(function (s) {
      return doUpload(s).catch(function (err) {
        if (err && (err.message && (err.message.indexOf('ExpiredToken') !== -1 || err.message.indexOf('expired') !== -1))) {
          return refreshSession().then(function (newS) { return doUpload(newS); });
        }
        throw err;
      });
    });
  }

  /** Create a record (rkey auto-generated) in the logged-in user's Bluesky repo. Returns { uri, cid }. Refreshes session on 401/ExpiredToken and retries once. */
  function createRecordToBluesky(collection, record) {
    var session = getStoredSession();
    if (!session || !session.accessJwt || !session.pdsUrl) return Promise.reject(new Error('Not connected to Bluesky'));
    function doCreate(s) {
      var url = s.pdsUrl.replace(/\/$/, '') + '/xrpc/com.atproto.repo.createRecord';
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.accessJwt },
        body: JSON.stringify({ repo: s.did, collection: collection, record: record })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            var msg = (err && (err.message || err.error)) || res.statusText;
            if (err && err.error) msg = (err.error + (err.message ? ': ' + err.message : ''));
            var e = new Error(msg);
            if (res.status === 401 || (err && (err.error === 'ExpiredToken' || (err.message && err.message.indexOf('expired') !== -1)))) e._expired = true;
            throw e;
          }).catch(function (parseErr) {
            if (parseErr._expired) throw parseErr;
            if (parseErr instanceof Error && parseErr.message && parseErr.message.indexOf('Unexpected') === -1) throw parseErr;
            throw new Error(res.status + ' ' + res.statusText);
          });
        }
        return res.json();
      });
    }
    return ensureSessionDid(session).then(function (s) {
      return doCreate(s).catch(function (err) {
        if ((err && err._expired) || (err && err.message && (err.message.indexOf('ExpiredToken') !== -1 || err.message.indexOf('expired') !== -1))) {
          return refreshSession().then(function (newS) { return doCreate(newS); });
        }
        throw err;
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

  /** Create a single feed post or a thread (replies). Returns promise that resolves to { postUris }. blobRefs optional for first post embed. */
  function postFeedTextOrThread(text, blobRefs) {
    var chunks = splitSentences(text, BSKY_POST_MAX);
    if (chunks.length === 0) return Promise.resolve({ postUris: [] });
    var now = new Date().toISOString();
    var refs = (blobRefs && blobRefs.length) ? blobRefs.slice(0, 4) : [];
    function makePost(txt, replyRef, embedRefs) {
      var rec = { $type: 'app.bsky.feed.post', text: txt, createdAt: now };
      if (replyRef) rec.reply = replyRef;
      if (embedRefs && embedRefs.length > 0) {
        rec.embed = { $type: 'app.bsky.embed.images', images: embedRefs.map(function (r) { return { image: r, alt: '' }; }) };
      }
      return rec;
    }
    return createRecordToBluesky('app.bsky.feed.post', makePost(chunks[0], null, refs))
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

  /** Extract blob refs { $link: cid } from body that contains getBlob URLs (from our upload). */
  function extractBlobRefsFromBody(body) {
    if (!body || typeof body !== 'string') return [];
    var refs = [];
    var re = /https?:\/\/[^\s"'<>]*getBlob[^\s"'<>]*(?:&(?:amp;)?[^\s"'<>]*)*/gi;
    var m;
    while ((m = re.exec(body)) !== null) {
      try {
        var u = new URL(m[0].replace(/&amp;/g, '&'));
        var cid = u.searchParams.get('cid');
        if (cid) refs.push({ $link: cid });
      } catch (_) {}
    }
    return refs.slice(0, 4);
  }

  /** Build full plain text for feed (title + body) and post as one or thread. Optional blobRefs for embed.images. */
  function postContentAsFeed(title, body, blobRefs) {
    var full = (title ? title + '\n\n' : '') + (body || '');
    var text = full.trim() || 'Posted from blendsky';
    return postFeedTextOrThread(text, blobRefs);
  }

  var syncingWikiSlug = null;
  var syncingForumId = null;

  /** Full sync: put site.standard.document (Standard.site) + post feed. Updates page.atUri. Refreshes token if expired; if document put fails, still posts feed so others find via #blendsky-wiki. */
  function doSyncWikiPage(slug) {
    var pages = getWikiPages();
    var page = pages[slug];
    if (!page || typeof BlendskyLexicon === 'undefined') return Promise.resolve();
    var session = getStoredSession();
    if (!session || !session.accessJwt) return Promise.resolve();
    syncingWikiSlug = slug;
    var baseUrl = typeof location !== 'undefined' ? location.origin : '';
    var record = BlendskyLexicon.documentFromWikiPage(page, slug, baseUrl);
    var rkey = sanitizeRkey(slug);
    var docPutError = null;
    return putRecordToBluesky(BlendskyLexicon.NS_DOCUMENT, rkey, record)
      .then(function (res) {
        page.atUri = res.uri;
        page.updatedAt = new Date().toISOString();
        return postContentAsFeed(page.title, (page.body || '') + '\n\n#blendsky-wiki');
      })
      .catch(function (err) {
        docPutError = err;
        return postContentAsFeed(page.title, (page.body || '') + '\n\n#blendsky-wiki');
      })
      .then(function () {
        pages[slug] = page;
        setWikiPages(pages);
        if (docPutError) {
          var msg = 'Document could not be saved to AT Protocol: ' + (docPutError.message || docPutError) + '. Your post was still published to Bluesky so others can find it via #blendsky-wiki.';
          return Promise.reject(new Error(msg));
        }
      })
      .catch(function (err) {
        if (err && err.message) console.error('Wiki sync:', err.message);
        throw err;
      })
      .then(function () { syncingWikiSlug = null; }, function (e) { syncingWikiSlug = null; throw e; });
  }

  /** Full sync: put site.standard.document (Standard.site) + post feed. Updates thread.atUri. Refreshes token if expired; if document put fails, still posts feed so others find via #blendsky-forum. */
  function doSyncForumThread(threadId) {
    var data = getForumData();
    var thread = data.threads.find(function (t) { return t.id === threadId; });
    if (!thread || typeof BlendskyLexicon === 'undefined') return Promise.resolve();
    var session = getStoredSession();
    if (!session || !session.accessJwt) return Promise.resolve();
    syncingForumId = threadId;
    var baseUrl = typeof location !== 'undefined' ? location.origin : '';
    var record = BlendskyLexicon.documentFromThread(thread, baseUrl);
    var rkey = sanitizeRkey(thread.path || 'thread-' + thread.id);
    var bodyWithTag = (thread.body || '') + '\n\n#blendsky-forum';
    var blobRefs = extractBlobRefsFromBody(thread.body || '');
    var docPutError = null;
    return putRecordToBluesky(BlendskyLexicon.NS_DOCUMENT, rkey, record)
      .then(function (res) {
        thread.atUri = res.uri;
        thread.updatedAt = new Date().toISOString();
        return postContentAsFeed(thread.title, bodyWithTag, blobRefs);
      })
      .catch(function (err) {
        docPutError = err;
        return postContentAsFeed(thread.title, bodyWithTag, blobRefs);
      })
      .then(function (result) {
        if (result && result.postUris && result.postUris[0]) thread.feedPostUri = result.postUris[0];
        setForumData(data);
        if (docPutError) {
          var msg = 'Document could not be saved to AT Protocol: ' + (docPutError.message || docPutError) + '. Your post was still published to Bluesky so others can find it via #blendsky-forum.';
          return Promise.reject(new Error(msg));
        }
      })
      .catch(function (err) {
        if (err && err.message) console.error('Forum sync:', err.message);
        throw err;
      })
      .then(function () { syncingForumId = null; }, function (e) { syncingForumId = null; throw e; });
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
          updateHeaderAuthState();
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
      updateHeaderAuthState();
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
        updateHeaderAuthState();
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
        updateHeaderAuthState();
        initBluesky();
      });
      return;
    }
    setStoredSession(null);
    document.getElementById('bluesky-connect').classList.remove('hidden');
    document.getElementById('bluesky-feed-wrap').classList.add('hidden');
    document.getElementById('bluesky-handle').value = '';
    if (document.getElementById('bluesky-app-password')) document.getElementById('bluesky-app-password').value = '';
    updateHeaderAuthState();
    initBluesky();
  });

  var homeLoadMore = document.getElementById('home-bluesky-load-more');
  if (homeLoadMore) {
    homeLoadMore.addEventListener('click', function () {
      loadHomeBlueskyFeed(true);
    });
  }

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

  /** Update header to show Log in vs Logged in as @handle (visible on every page). */
  function updateHeaderAuthState() {
    var loginWrap = document.getElementById('header-login-wrap');
    var userWrap = document.getElementById('header-user-wrap');
    var userLink = document.getElementById('header-user-link');
    if (!loginWrap || !userWrap) return;
    var session = getStoredSession();
    if (session && session.handle) {
      loginWrap.classList.add('hidden');
      userWrap.classList.remove('hidden');
      if (userLink) {
        userLink.textContent = '@' + session.handle;
        userLink.href = '#';
      }
    } else {
      loginWrap.classList.remove('hidden');
      userWrap.classList.add('hidden');
    }
  }

  updateHeaderAuthState();

  // Start on home
  showView('home');
    })();
  });
