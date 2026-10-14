/* Public in-app notices. GitHub enforces administrator write access. */
(function (root) {
    'use strict';
    const FILE = 'avisos.json';
    const targets = ['home', 'movies', 'movies2', 'series', 'animados', 'tv', 'radio', 'payments'];
    const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
    function validate(feed) {
        if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.notices) || feed.notices.length > 100) throw new Error('Formato de avisos inválido.');
        const ids = new Set();
        for (const notice of feed.notices) {
            if (!notice || typeof notice.id !== 'string' || !notice.id || ids.has(notice.id)) throw new Error('Hay identificadores de avisos duplicados o inválidos.');
            ids.add(notice.id);
            if (typeof notice.title !== 'string' || !notice.title.trim() || notice.title.length > 120 || typeof notice.message !== 'string' || !notice.message.trim() || notice.message.length > 1000) throw new Error('Cada aviso necesita un título y un mensaje dentro de los límites.');
            if (!targets.includes(notice.target) || !validDate(notice.createdAt) || !validDate(notice.updatedAt) || (notice.expiresAt !== null && (!validDate(notice.expiresAt) || Date.parse(notice.expiresAt) <= Date.parse(notice.createdAt)))) throw new Error('La sección o las fechas del aviso no son válidas.');
        }
        return feed;
    }
    const revision = notice => `${notice.id}@${notice.updatedAt}`;
    function active(feed, now = Date.now()) {
        return validate(feed).notices.filter(notice => Date.parse(notice.createdAt) <= now && (!notice.expiresAt || Date.parse(notice.expiresAt) > now)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    const unread = (items, readKeys) => items.filter(notice => !readKeys.includes(revision(notice)));
    function create({ id, title, message, target = 'home', expiresAt = null }, now = new Date().toISOString()) {
        const notice = { id: id || root.crypto?.randomUUID?.() || `notice-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), message: message.trim(), target, expiresAt, createdAt: now, updatedAt: now };
        validate({ schemaVersion: 1, notices: [notice] });
        return notice;
    }
    async function load(fetcher = root.fetch.bind(root)) {
        const source = root.BoxNoticesConfig?.feedUrl || `./${FILE}`;
        const response = await fetcher(`${source}${source.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudieron actualizar los avisos. Intenta de nuevo.');
        return validate(await response.json());
    }
    async function badge(count, navigatorObject = root.navigator) {
        try {
            if (count > 0 && typeof navigatorObject?.setAppBadge === 'function') { await navigatorObject.setAppBadge(count); return true; }
            if (count === 0 && typeof navigatorObject?.clearAppBadge === 'function') { await navigatorObject.clearAppBadge(); return true; }
        } catch { /* In-app unread count remains available when the OS rejects badging. */ }
        return false;
    }
    function encode(value) {
        const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return root.btoa(binary);
    }
    function decode(content) {
        const bytes = Uint8Array.from(root.atob(content.replace(/\s/g, '')), character => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    }
    async function endpoint() {
        if (!root.BoxNoticesConfig) await root.BoxCatalog.ready;
        const { repository, branch } = root.BoxNoticesConfig || root.BoxCatalog.config;
        if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || typeof branch !== 'string' || !branch) throw new Error('El destino de los avisos no está configurado.');
        return { url: `https://api.github.com/repos/${repository}/contents/${FILE}`, branch };
    }
    function headers(token) {
        if (typeof token !== 'string' || !token.trim()) throw new Error('Introduce una credencial de GitHub autorizada para publicar.');
        return { Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    }
    function failure(status) {
        if (status === 409 || status === 422) return new Error('Los avisos cambiaron en GitHub. Actualiza la lista antes de volver a publicar.');
        if ([401, 403, 404].includes(status)) return new Error('No se pudo acceder a los avisos. Verifica la credencial, el repositorio y el permiso Contents: escritura.');
        return new Error('No se confirmó la publicación. Conserva tu borrador y comprueba la lista antes de reintentar.');
    }
    async function repository(token, fetcher = root.fetch.bind(root)) {
        const { url, branch } = await endpoint();
        let response;
        const requestHeaders = headers(token);
        try { response = await fetcher(`${url}?ref=${encodeURIComponent(branch)}`, { headers: requestHeaders, cache: 'no-store' }); }
        catch { throw new Error('No se pudo consultar GitHub. Conserva el borrador e intenta actualizar la lista.'); }
        if (!response.ok) throw failure(response.status);
        const data = await response.json();
        if (typeof data.sha !== 'string' || typeof data.content !== 'string' || data.encoding !== 'base64') throw new Error('La respuesta de GitHub no contiene una versión válida de los avisos.');
        return { feed: validate(decode(data.content)), sha: data.sha };
    }
    async function publish({ token, feed, sha }, fetcher = root.fetch.bind(root)) {
        validate(feed);
        if (typeof sha !== 'string' || !sha) throw new Error('Primero descarga la versión actual de los avisos.');
        const { url, branch } = await endpoint();
        let response;
        const requestHeaders = { ...headers(token), 'Content-Type': 'application/json' };
        try { response = await fetcher(url, { method: 'PUT', headers: requestHeaders, body: JSON.stringify({ message: 'Actualizar avisos de Box Play TV', branch, sha, content: encode(feed) }) }); }
        catch { throw failure(0); }
        if (!response.ok) throw failure(response.status);
        const data = await response.json();
        if (!data.commit?.sha || !data.content?.sha) throw new Error('No se recibió confirmación completa. Actualiza la lista antes de reintentar.');
        return data;
    }
    const api = { FILE, targets, validate, revision, active, unread, create, load, badge, encode, decode, repository, publish };
    root.BoxNotices = api;
    if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
