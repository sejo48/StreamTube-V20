/* Select released titles for the home carousel without reordering the catalog. */
(function (root) {
    'use strict';
    const label = item => String(item.title || item.titulo || item.name || '').trim();
    function releaseDay(item) {
        const value = String(item.fechaEstreno || item.release_date || item.releaseDate || '').trim();
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (match) {
            const date = match.slice(1).join('-'), parsed = new Date(date + 'T00:00:00Z');
            if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === date) return date;
        }
        const year = String(item.year || item.anio || '').trim();
        return /^\d{4}$/.test(year) ? year + '-01-01' : '';
    }
    function select(content, now = new Date(), limit = 5) {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Costa_Rica', year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now);
        const part = key => parts.find(value => value.type === key).value;
        const today = `${part('year')}-${part('month')}-${part('day')}`;
        const seen = new Set(), out = [];
        for (const source of ['movies2', 'movies', 'series', 'animados']) {
            const sorted = (content[source] || []).map((item,index) => ({item,index,date:releaseDay(item)})).filter(entry => !entry.date || entry.date <= today).sort((a,b) => b.date.localeCompare(a.date) || a.index-b.index);
            for (const {item} of sorted) {
                const title = label(item), key = title.toLocaleLowerCase('es') + '|' + String(item.year || releaseDay(item).slice(0,4));
                if (!title || seen.has(key)) continue;
                seen.add(key);out.push(item);
                if (out.length === limit) return out;
            }
        }
        return out;
    }
    root.BoxHomeFeatures = { select, releaseDay };
    if (typeof module !== 'undefined') module.exports = root.BoxHomeFeatures;
})(typeof window !== 'undefined' ? window : globalThis);
