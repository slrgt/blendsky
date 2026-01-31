/**
 * standard.site lexicons compatibility
 * Schema aligned with https://tangled.org/standard.site/lexicons
 * (site.standard.document, site.standard.publication)
 * Compatible with [atcute](https://tangled.org/mary.my.id/atcute) (@atcute/standard-site, @atcute/pckt),
 * pckt.blog, Leaflet, Offprint, and other standard.site / atcute-based apps.
 */

(function (global) {
  'use strict';

  const NS_DOCUMENT = 'site.standard.document';
  const NS_PUBLICATION = 'site.standard.publication';

  /** site.standard.document record shape (metadata for a post/article) */
  function documentFromThread(thread, baseUrl) {
    const now = new Date().toISOString();
    return {
      site: baseUrl || (typeof location !== 'undefined' ? location.origin : ''),
      path: thread.path ? '/' + thread.path.replace(/^\//, '') : '/thread/' + thread.id,
      title: thread.title || 'Untitled',
      description: thread.description || '',
      textContent: thread.textContent || (thread.body || '').replace(/\n/g, ' ').slice(0, 300),
      tags: Array.isArray(thread.tags) ? thread.tags : [],
      publishedAt: thread.publishedAt || thread.createdAt || now,
      updatedAt: thread.updatedAt || thread.publishedAt || thread.createdAt || now,
      bskyPostRef: thread.bskyPostRef || undefined
    };
  }

  /** Normalize forum thread to include standard.site document fields */
  function threadToDocumentShape(thread, baseUrl) {
    const doc = documentFromThread(thread, baseUrl);
    return {
      $type: NS_DOCUMENT,
      ...doc,
      content: thread.body,
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

  /** Convert fetched AT record (site.standard.document) into a forum thread for display */
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

  global.StandardSite = {
    NS_DOCUMENT: NS_DOCUMENT,
    NS_PUBLICATION: NS_PUBLICATION,
    documentFromThread: documentFromThread,
    threadToDocumentShape: threadToDocumentShape,
    parseAtUri: parseAtUri,
    atUri: atUri,
    recordToThread: recordToThread
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
