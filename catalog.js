/* Shared catalog contract. This draft performs read requests only. */
(function (root) {
    'use strict';
    const files = ['peliculas.json', 'peliculas2.json', 'playlist.json', 'animados.json', 'radios.json', 'tudum.json', 'videoteca.json', 'listaoficial.m3u'];
    const config = { repository: 'sejo48/StreamTube-V20', branch: 'main', mode: 'draft' };
    const clone = value => JSON.parse(JSON.stringify(value));
    function hash(value) {
        let h = 2166136261;
        for (const c of String(value)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(16).padStart(8, '0');
    }
    const title = item => String(item.tituloSerie || item.tituloEpisodio || item.titulo || item.title || item.album || '').trim();
    function id(item, namespace) {
        if (item.id !== undefined && item.id !== null && String(item.id).trim()) return String(item.id);
        const source = item.urlDrive || item.urlOkRu || item.url || item.audio || item.musicUrl || (item.temporadas || []).flatMap(season => season.episodios || []).map(ep => ep.urlDrive || ep.url || '').join('|');
        return `${namespace.replace(/\W/g, '-')}-${hash(title(item) + '|' + (item.artist || item.artista || '') + '|' + source)}`;
    }
    function identify(items, namespace) {
        if (!Array.isArray(items)) throw new Error(`${namespace}: se esperaba una lista.`);
        return items.map((item, index) => {
            const out = { ...item, id: id(item, namespace) };
            delete out.isNew;
            const legacyPrefix = { 'peliculas.json': 'mov-1', 'peliculas2.json': 'mov-2', 'playlist.json': 'serie', 'animados.json': 'anim' }[namespace];
            if (!item.id && legacyPrefix) out.legacyIds = [`${legacyPrefix}-${index}`];
            if (Array.isArray(item.temporadas)) out.temporadas = item.temporadas.map((season, i) => ({
                ...season, id: id({ ...season, title: String(season.numeroTemporada || i + 1) }, out.id + '-season'),
                episodios: identify(season.episodios || [], out.id + '-season-' + (season.numeroTemporada || i + 1)).map((episode, e) => {
                    if (!season.episodios[e].id && ['playlist.json', 'animados.json'].includes(namespace)) episode.legacyIds = [`${namespace === 'animados.json' ? 'ep-anim' : 'ep'}-${index}-${i}-${e}`];
                    return episode;
                })
            }));
            if (Array.isArray(item.tracks || item.pistas)) out.tracks = identify(item.tracks || item.pistas, out.id + '-track');
            return out;
        });
    }
    function restoreLocal(items, baseline, namespace) {
        const restored = items.map(item => {
            const matches = baseline.filter(candidate => title(candidate) === title(item));
            const exact = baseline.find(candidate => candidate.id === item.id);
            const oldId = /^(mov|est|serie|anim|cr|vid|tudum|tv|pista|ep(?:-anim)?)-\d+(?:-\d+)*$/.test(String(item.id));
            const previous = exact || (oldId && matches.length === 1 ? matches[0] : null);
            const out = { ...item };
            if (previous) { out.id = previous.id; if (previous.legacyIds) out.legacyIds = previous.legacyIds; }
            else if (oldId) delete out.id;
            if (Array.isArray(out.temporadas)) out.temporadas = out.temporadas.map((season, i) => {
                const priorSeason = previous && (previous.temporadas || []).find(t => t.numeroTemporada === season.numeroTemporada);
                return { ...season, episodios: restoreLocal(season.episodios || [], priorSeason ? priorSeason.episodios : [], (out.id || id(out, namespace)) + '-season-' + (season.numeroTemporada || i + 1)) };
            });
            return out;
        });
        return identify(restored, namespace);
    }
    function rawUrl(file) {
        return `https://raw.githubusercontent.com/${config.repository}/${encodeURIComponent(config.branch)}/${file}`;
    }
    const ready = typeof document === 'undefined' ? Promise.resolve(config) : (async () => {
        const response = await fetch('./catalog-config.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo cargar la configuración de catálogos.');
        const value = await response.json();
        if (!/^[\w.-]+\/[\w.-]+$/.test(value.repository) || !value.branch || value.mode !== 'draft') throw new Error('Configuración de borrador inválida.');
        Object.assign(config, value);
        return config;
    })();
    // Attach a handler immediately; callers still observe rejection when awaiting ready.
    ready.catch(() => {});
    async function read(file, fetcher = root.fetch.bind(root)) {
        await ready;
        if (!files.includes(file)) throw new Error('Catálogo desconocido.');
        let response = await fetcher('./' + file, { cache: 'no-store' });
        // Only a missing local file permits the configured remote fallback.
        if (response.status === 404) response = await fetcher(rawUrl(file), { cache: 'no-store' });
        if (!response.ok) throw new Error(`${file}: descarga fallida (${response.status}). Se conservaron los datos anteriores.`);
        const text = await response.text();
        if (file.endsWith('.m3u')) {
            if (!text.trim().startsWith('#EXTM3U')) throw new Error(`${file}: formato M3U inválido.`);
            return text;
        }
        try { return identify(JSON.parse(text), file); }
        catch (error) { throw new Error(`${file}: ${error.message}`); }
    }
    async function readAll(fetcher) {
        const values = await Promise.all(files.map(file => read(file, fetcher)));
        return Object.fromEntries(files.map((file, i) => [file, values[i]]));
    }
    function serializeAll(state) {
        const names = { movies: 'peliculas.json', estrenos: 'peliculas2.json', series: 'playlist.json', animados: 'animados.json', radios: 'radios.json', tudumList: 'tudum.json', videoteca: 'videoteca.json' };
        const datasets = {};
        for (const [name, file] of Object.entries(names)) datasets[file] = identify(clone(state[name]), file);
        datasets['listaoficial.m3u'] = '#EXTM3U\n' + state.channels.map(ch => {
            const clean = value => String(value || '').replace(/[\r\n"]/g, ' ');
            return `#EXTINF:-1 tvg-id="${clean(id(ch, 'tv'))}" tvg-name="${clean(ch.title)}" tvg-logo="${clean(ch.logo || ch.image)}" group-title="${clean(ch.group || 'General')}",${clean(ch.title)}\n${ch.url || ''}\n`;
        }).join('');
        return datasets;
    }
    function parseM3U(text) {
        const lines = String(text).split(/\r?\n/), items = [];
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('#EXTINF:')) continue;
            const field = name => (lines[i].match(new RegExp(name + '="([^"]*)"')) || [,''])[1];
            const item = { title: lines[i].slice(lines[i].lastIndexOf(',') + 1).trim(), url: (lines[i + 1] || '').trim(), logo: field('tvg-logo'), group: field('group-title') };
            item.id = field('tvg-id') || id(item, 'tv');
            items.push(item);
        }
        return items;
    }
    const urlValid = value => { if (typeof value !== 'string' || /[\r\n]/.test(value)) return false; try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
    function validate(datasets) {
        const errors = [];
        for (const file of files) {
            const raw = datasets[file];
            if (raw === undefined) { errors.push(`${file}: falta el catálogo.`); continue; }
            const items = file.endsWith('.m3u') ? parseM3U(raw) : raw;
            if (!Array.isArray(items) || !items.length) { errors.push(`${file}: catálogo vacío o inválido; requiere revisión.`); continue; }
            function check(list, scope) {
                const local = new Set();
                for (const item of list) {
                    const name = title(item);
                    if (!name) errors.push(`${scope}: falta un título.`);
                    if (!item.id || local.has(String(item.id))) errors.push(`${scope}: ID ausente o duplicado (${name}).`);
                    local.add(String(item.id));
                }
            }
            check(items, file);
            for (const item of items) {
                const name = title(item);
                const seasons = item.temporadas;
                if (seasons !== undefined && !Array.isArray(seasons)) { errors.push(`${file}: temporadas inválidas (${name}).`); continue; }
                if (Array.isArray(seasons) && seasons.length) {
                    const numbers = new Set();
                    for (const season of seasons) {
                        const number = Number(season.numeroTemporada);
                        if (!Number.isInteger(number) || number < 1 || numbers.has(number)) errors.push(`${file}: número de temporada inválido o duplicado (${name}).`);
                        numbers.add(number);
                        if (!Array.isArray(season.episodios) || !season.episodios.length) { errors.push(`${file}: temporada sin episodios (${name}).`); continue; }
                        check(season.episodios, `${file} / ${name}`);
                        for (const episode of season.episodios) if (!urlValid(episode.urlDrive || episode.url || episode.urlOkRu)) errors.push(`${file}: episodio sin enlace válido (${name} / ${title(episode)}).`);
                    }
                } else if (file === 'playlist.json') errors.push(`${file}: serie sin temporadas (${name}).`);
                else if (['peliculas.json', 'peliculas2.json', 'animados.json', 'radios.json', 'listaoficial.m3u'].includes(file) && !urlValid(item.urlDrive || item.url || item.urlOkRu || item.stream)) errors.push(`${file}: falta un enlace válido (${name}).`);
                if (file === 'tudum.json' && !urlValid(item.trailerUrl || item.urlTrailer)) errors.push(`${file}: tráiler sin enlace válido (${name}).`);
                if (file === 'videoteca.json') {
                    const tracks = item.tracks || item.pistas || [];
                    if (!tracks.length && !urlValid(item.musicUrl || item.urlDrive || item.url)) errors.push(`${file}: álbum sin audio (${name}).`);
                    check(tracks, `${file} / ${name}`);
                    for (const track of tracks) if (!urlValid(track.audio || track.urlDrive || track.url)) errors.push(`${file}: pista sin enlace válido (${name} / ${title(track)}).`);
                }
            }
        }
        return errors;
    }
    function canonical(value) {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object') {
            const out = { ...value };
            if (out.trailerUrl && (out.releaseDate || out.synopsis) && out.image === out.imagen) delete out.imagen;
            if (out.imagen && out.image === out.imagen) delete out.image;
            if (out.logo && out.imagen === out.logo) delete out.imagen;
            if (out.cover && out.imagen === out.cover) delete out.imagen;
            if (out.cover && out.image === out.cover) delete out.image;
            if (out.trailerUrl && out.image && out.imagen === out.image) delete out.imagen;
            for (const key of ['temporadas', 'tracks']) if (Array.isArray(out[key]) && !out[key].length) delete out[key];
            return Object.fromEntries(Object.keys(out).sort().map(key => [key, canonical(out[key])]));
        }
        return value;
    }
    function summarize(before, after) {
        return files.map(file => {
            const items = value => file.endsWith('.m3u') ? parseM3U(value) : identify(value, file);
            const old = new Map(items(before[file]).map(item => [item.id, item]));
            const next = new Map(items(after[file]).map(item => [item.id, item]));
            const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
            return { file, added: [...next.keys()].filter(key => !old.has(key)).length, removed: [...old.keys()].filter(key => !next.has(key)).length, modified: [...next.keys()].filter(key => old.has(key) && !same(old.get(key), next.get(key))).length, total: next.size };
        });
    }
    function makeDraft(before, after) {
        // A baseline must be complete, even if its existing content needs repair.
        for (const file of files) if (before[file] === undefined || after[file] === undefined) throw new Error('No se puede preparar el borrador sin descargar todos los catálogos.');
        const errors = validate(after);
        return { schemaVersion: 1, mode: 'draft', published: false, repository: config.repository, branch: config.branch, createdAt: new Date().toISOString(), validation: { passed: !errors.length, errors }, summary: summarize(before, after), baseline: clone(before), datasets: clone(after) };
    }
    const api = { files, config, ready, id, identify, restoreLocal, read, readAll, serializeAll, parseM3U, validate, summarize, makeDraft };
    root.BoxCatalog = api;
    if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
