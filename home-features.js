/* Choose a fresh set of highlights from the complete Trends collection. */
(function (root) {
    'use strict';
    const label = item => String(item?.title || item?.titulo || item?.name || '').trim();
    const key = item => label(item) ? label(item).toLocaleLowerCase('es').replace(/\s+/g,' ') + '|' + String(item.year || item.anio || '').trim() : '';
    function pool(content) {
        const source = Array.isArray(content.trends) && content.trends.length ? content.trends : [...(content.movies2 || []), ...(content.movies || []), ...(content.series || [])];
        const seen = new Set();
        return source.filter(item => {
            const identity = key(item);
            if (!identity || seen.has(identity)) return false;
            seen.add(identity); return true;
        });
    }
    function select(content, { previous = '', limit = 5, random = Math.random } = {}) {
        const shuffled = [...pool(content)];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Avoid the cover last displayed before reloading, even if the shuffle picked it.
        if (shuffled.length > 1 && key(shuffled[0]) === previous) {
            const alternative = shuffled.findIndex(item => key(item) !== previous);
            if (alternative > 0) [shuffled[0], shuffled[alternative]] = [shuffled[alternative], shuffled[0]];
        }
        return shuffled.slice(0, limit);
    }
    root.BoxHomeFeatures = { pool, select, key };
    if (typeof module !== 'undefined') module.exports = root.BoxHomeFeatures;
})(typeof window !== 'undefined' ? window : globalThis);
