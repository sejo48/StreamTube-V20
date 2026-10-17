/* Recover radio preferences saved by older versions without sharing empty IDs. */
(function (root) {
    'use strict';
    const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    const title = item => text(item?.title || item?.titulo || item?.name || item?.nombre);
    const url = item => text(item?.url || item?.urlDrive || item?.stream || item?.urlStream || item?.audio);
    const name = value => text(value).normalize('NFKC').toLocaleLowerCase('es');
    const validUrl = value => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !!parsed.hostname; } catch { return false; } };
    function hash(value) { let h=2166136261;for(const c of value){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16); }
    function key(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
        if (text(item.id)) return 'id:' + text(item.id);
        const stream = url(item), label = title(item);
        return stream || label ? 'radio:' + hash(stream + '|' + name(label)) : '';
    }
    function normalize(records, catalog = []) {
        const items = [], rejected = [], seen = new Set();
        const live = Array.isArray(catalog) ? catalog.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
        const unique = matches => matches.length === 1 ? matches[0] : null;
        for (const record of Array.isArray(records) ? records : records == null ? [] : [records]) {
            let item = record && typeof record === 'object' && !Array.isArray(record) ? record : null;
            let match;
            if (!item) {
                const token = text(record);
                match = token && unique(live.filter(entry => text(entry.id) === token || (Array.isArray(entry.legacyIds) ? entry.legacyIds : []).includes(token) || url(entry) === token || name(title(entry)) === name(token)));
                if (!match && validUrl(token)) item = { url: token };
            } else {
                const id = text(item.id), stream = url(item), label = title(item);
                match = (id && unique(live.filter(entry => text(entry.id) === id || (Array.isArray(entry.legacyIds) ? entry.legacyIds : []).includes(id)))) ||
                    (stream && (unique(live.filter(entry => url(entry) === stream && name(title(entry)) === name(label))) || unique(live.filter(entry => url(entry) === stream)))) ||
                    (label && unique(live.filter(entry => name(title(entry)) === name(label))));
            }
            if (match) item = { ...item, ...match };
            if (!item) { rejected.push(record); continue; }
            const stream = url(item), label = title(item);
            if (!label && !validUrl(stream)) { rejected.push(record); continue; }
            const displayTitle = label || new URL(stream).hostname;
            const normalized = { ...item, title: displayTitle, url: validUrl(stream) ? stream : '', image: text(item.image || item.imagen || item.logo), group: text(item.group || item.genero || item.categoria) || 'Radio', type: 'radio' };
            normalized.id = text(item.id) || 'radio-' + hash(normalized.url + '|' + name(displayTitle));
            let identity = key(normalized);
            const previous = items.find(entry => key(entry) === identity);
            if (previous && (previous.url !== normalized.url || name(previous.title) !== name(normalized.title))) {
                normalized.id = 'radio-' + hash(normalized.url + '|' + name(displayTitle));
                identity = key(normalized);
            }
            if (!seen.has(identity)) { seen.add(identity); items.push(normalized); }
        }
        return { items, rejected };
    }
    root.BoxRadioFavorites = { normalize, key };
    if (typeof module !== 'undefined') module.exports = root.BoxRadioFavorites;
})(typeof window !== 'undefined' ? window : globalThis);
