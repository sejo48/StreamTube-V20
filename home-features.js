/* Home highlights use curated Estrenos or recent releases, with verified panoramic artwork. */
(function (root) {
    'use strict';
    const Covers = root.BoxHomeCovers || (typeof module !== 'undefined' ? require('./home-covers.js') : null);
    const label = item => String(item?.title || item?.titulo || item?.name || '').trim();
    const key = item => label(item) ? label(item).toLocaleLowerCase('es').replace(/\s+/g,' ') + '|' + String(item.year || item.anio || '').trim() : '';
    function unique(source) {
        const seen = new Set();
        return source.filter(item => {
            const identity = key(item);
            if (!identity || seen.has(identity)) return false;
            seen.add(identity); return true;
        });
    }
    // The discovery shelf retains its complete collection, independently of the hero.
    function pool(content) {
        return unique(Array.isArray(content.trends) && content.trends.length ? content.trends : [...(content.movies2 || []), ...(content.movies || []), ...(content.series || [])]);
    }
    function panorama(item) {
        // An explicit empty value prevents normalized poster fallbacks from becoming backgrounds.
        return String(Object.hasOwn(item, 'panoramicImage') ? item.panoramicImage : item.backdrop || item.banner || '').trim();
    }
    function today() {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-');
    }
    function releaseDay(item) {
        const raw = String(item.fechaEstreno || item.release_date || item.releaseDate || '');
        if (raw) {
            const day = raw.slice(0, 10), date = new Date(day + 'T00:00:00Z');
            return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : '';
        }
        const year = String(item.year || item.anio || '');
        return /^\d{4}$/.test(year) ? year + '-01-01' : '';
    }
    function candidates(content, { day = today() } = {}) {
        return unique((content.movies2 || []).filter(item => {
            const release = item && releaseDay(item);
            return release && release <= day && panorama(item) && label(item);
        }).sort((a,b) => releaseDay(b).localeCompare(releaseDay(a))));
    }
    function select(items, { previous = '', limit = 5, random = Math.random } = {}) {
        // Keep the curated pool (or newest automatic choices) before randomizing the cover.
        const shuffled = items.slice(0, limit);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (shuffled.length > 1 && key(shuffled[0]) === previous) {
            const alternative = shuffled.findIndex(item => key(item) !== previous);
            if (alternative > 0) [shuffled[0], shuffled[alternative]] = [shuffled[alternative], shuffled[0]];
        }
        return shuffled;
    }
    const verifiedImages = new Map();
    function probeImage(url) {
        if (verifiedImages.has(url)) return Promise.resolve(verifiedImages.get(url));
        return new Promise(resolve => {
            const image = new Image();
            let timer;
            const finish = result => {
                clearTimeout(timer); image.onload = image.onerror = null;
                if (result) verifiedImages.set(url, result);
                resolve(result);
            };
            image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => finish(null);
            timer = setTimeout(() => finish(null), 5000);
            image.src = url;
        });
    }
    async function load(content, { probe = probeImage, limit = 5, isCancelled = () => false, configuration = null, ...options } = {}) {
        const source = configuration?.mode === 'manual' ? Covers.resolve(configuration, content.movies2) : candidates(content, options), valid = [];
        // Check in small batches, preserving release order even when images finish out of order.
        for (let start = 0; start < source.length && valid.length < limit && !isCancelled(); start += 5) {
            const batch = source.slice(start, start + 5);
            const results = await Promise.all(batch.map(async item => {
                try {
                    const size = await probe(panorama(item));
                    return size?.height > 0 && size.width / size.height >= 1.5 ? item : null;
                } catch { return null; }
            }));
            valid.push(...results.filter(Boolean));
        }
        return isCancelled() ? [] : select(valid, { ...options, limit });
    }
    root.BoxHomeFeatures = { pool, candidates, panorama, select, load, key };
    if (typeof module !== 'undefined') module.exports = root.BoxHomeFeatures;
})(typeof window !== 'undefined' ? window : globalThis);
