/**
 * blendsky lexicon — one document type for forum posts and wiki articles on the AT Protocol.
 * NSID: app.blendsky.document
 * Used for forums and wikis published from this app; discoverable by collection on the AT Protocol.
 */

(function (global) {
  'use strict';

  const NS_DOCUMENT = 'app.blendsky.document';

  /** app.blendsky.document record shape for a wiki page. kind: 'wiki'. */
  function documentFromWikiPage(page, slug, baseUrl) {
    const now = new Date().toISOString();
    const body = page.body || '';
    const doc = {
      $type: NS_DOCUMENT,
      kind: 'wiki',
      site: baseUrl || (typeof location !== 'undefined' ? location.origin : ''),
      path: '/' + (slug || 'untitled').replace(/^\//, ''),
      title: page.title || 'Untitled',
      description: '',
      textContent: body.replace(/\n/g, ' ').slice(0, 300),
      tags: [],
      publishedAt: page.publishedAt || now,
      updatedAt: page.updatedAt || now,
      content: body
    };
    if (page.remixedFrom) doc.forkOf = page.remixedFrom;
    return doc;
  }

  /** app.blendsky.document record shape for a forum thread. kind: 'forum'. */
  function documentFromThread(thread, baseUrl) {
    const now = new Date().toISOString();
    return {
      $type: NS_DOCUMENT,
      kind: 'forum',
      site: baseUrl || (typeof location !== 'undefined' ? location.origin : ''),
      path: thread.path ? '/' + thread.path.replace(/^\//, '') : '/thread/' + thread.id,
      title: thread.title || 'Untitled',
      description: thread.description || '',
      textContent: thread.textContent || (thread.body || '').replace(/\n/g, ' ').slice(0, 300),
      tags: Array.isArray(thread.tags) ? thread.tags : [],
      publishedAt: thread.publishedAt || thread.createdAt || now,
      updatedAt: thread.updatedAt || thread.publishedAt || thread.createdAt || now,
      content: thread.body || '',
      bskyPostRef: thread.bskyPostRef || undefined
    };
  }

  /** Normalize forum thread to full document shape (for export). */
  function threadToDocumentShape(thread, baseUrl) {
    const doc = documentFromThread(thread, baseUrl);
    return {
      $type: NS_DOCUMENT,
      ...doc,
      id: thread.id,
      author: thread.author,
      replies: thread.replies
    };
  }

  /** Parse AT URI into repo, collection, rkey */
  function parseAtUri(uri) {
    const m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
    return m ? { repo: m[1], collection: m[2], rkey: m[3] } : null;
  }

  /** Build AT URI */
  function atUri(repo, collection, rkey) {
    return 'at://' + repo + '/' + collection + '/' + rkey;
  }

  /** Convert fetched AT record (app.blendsky.document) into a forum thread for display */
  function recordToThread(record, uri, author) {
    if (!record || typeof record !== 'object') return null;
    const title = record.title || 'Untitled';
    const body = record.content || record.textContent || '';
    const path = (record.path && record.path.replace(/^\//, '')) || '';
    return {
      id: 'at-' + (record.tid || record.path || uri).replace(/[^a-zA-Z0-9-]/g, '-'),
      atUri: uri,
      title: title,
      description: record.description || '',
      body: body,
      textContent: record.textContent || '',
      path: path,
      tags: Array.isArray(record.tags) ? record.tags : [],
      publishedAt: record.publishedAt || '',
      updatedAt: record.updatedAt || '',
      author: author || 'AT Protocol',
      replies: [],
      _imported: true
    };
  }

  global.BlendskyLexicon = {
    NS_DOCUMENT: NS_DOCUMENT,
    documentFromWikiPage: documentFromWikiPage,
    documentFromThread: documentFromThread,
    threadToDocumentShape: threadToDocumentShape,
    parseAtUri: parseAtUri,
    atUri: atUri,
    recordToThread: recordToThread
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
