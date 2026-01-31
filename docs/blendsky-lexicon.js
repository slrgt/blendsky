/**
 * blendsky — wiki and forum as Standard.site documents (https://standard.site).
 * Uses site.standard.document so forum and wiki posts work like blog posts:
 * path, title, content. Discovery and portability via Standard.site.
 */

(function (global) {
  'use strict';

  const NS_DOCUMENT = 'site.standard.document';

  /** site.standard.document record for a wiki page. path: /wiki/slug. site: app origin so Constellation can index by target. */
  function documentFromWikiPage(page, slug, baseUrl) {
    var path = '/wiki/' + (slug || 'untitled').replace(/^\//, '').replace(/^wiki\/?/, '');
    if (path === '/wiki/') path = '/wiki/untitled';
    var doc = {
      $type: NS_DOCUMENT,
      path: path,
      title: page.title || 'Untitled',
      content: page.body || ''
    };
    if (baseUrl && (baseUrl.indexOf('http://') === 0 || baseUrl.indexOf('https://') === 0)) doc.site = baseUrl.replace(/\/$/, '');
    return doc;
  }

  /** site.standard.document record for a forum thread. path: /forum/threadPath. site: app origin for Constellation. */
  function documentFromThread(thread, baseUrl) {
    var pathSeg = (thread.path && thread.path.replace(/^\//, '')) || ('thread-' + thread.id);
    var path = '/forum/' + pathSeg;
    var content = (thread.description ? thread.description + '\n\n' : '') + (thread.body || '');
    var doc = {
      $type: NS_DOCUMENT,
      path: path,
      title: thread.title || 'Untitled',
      content: content.trim() || '(No content)'
    };
    if (baseUrl && (baseUrl.indexOf('http://') === 0 || baseUrl.indexOf('https://') === 0)) doc.site = baseUrl.replace(/\/$/, '');
    return doc;
  }

  /** Normalize forum thread to document shape (for export). */
  function threadToDocumentShape(thread, baseUrl) {
    var doc = documentFromThread(thread, baseUrl);
    return {
      $type: NS_DOCUMENT,
      path: doc.path,
      title: doc.title,
      content: doc.content,
      id: thread.id,
      author: thread.author,
      replies: thread.replies
    };
  }

  /** Parse AT URI into repo, collection, rkey */
  function parseAtUri(uri) {
    var m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
    return m ? { repo: m[1], collection: m[2], rkey: m[3] } : null;
  }

  /** Build AT URI */
  function atUri(repo, collection, rkey) {
    return 'at://' + repo + '/' + collection + '/' + rkey;
  }

  /** Convert fetched site.standard.document (or legacy app.blendsky.document) into a forum thread for display */
  function recordToThread(record, uri, author) {
    if (!record || typeof record !== 'object') return null;
    var title = record.title || 'Untitled';
    var body = record.content || record.textContent || '';
    var path = (record.path && record.path.replace(/^\//, '')) || '';
    return {
      id: 'at-' + (record.tid || record.path || uri).replace(/[^a-zA-Z0-9-]/g, '-'),
      atUri: uri,
      title: title,
      description: record.description || '',
      body: body,
      textContent: record.textContent || body,
      path: path.replace(/^forum\/?/, '').replace(/^wiki\/?/, ''),
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
