const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../catalog.js');
const root = path.resolve(__dirname, '..');
function baseline() {
    return Object.fromEntries(C.files.map(file => [file, file.endsWith('.m3u') ? fs.readFileSync(path.join(root, file), 'utf8') : C.identify(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')), file)]));
}
test('IDs persist when items are reordered and titles are edited', () => {
    const original = C.identify([{ titulo: 'A', urlDrive: 'https://example.com/a' }, { titulo: 'B', urlDrive: 'https://example.com/b' }], 'peliculas.json');
    const changed = C.identify([{ ...original[1], titulo: 'B editado' }, original[0]], 'peliculas.json');
    assert.equal(changed[0].id, original[1].id);
    assert.equal(changed[1].id, original[0].id);
    assert.deepEqual(original[0].legacyIds, ['mov-1-0']);
});
test('episode IDs do not depend on ordering; old progress aliases are retained', () => {
    const [series] = C.identify([{ tituloSerie: 'S', temporadas: [{ numeroTemporada: 1, episodios: [{ tituloEpisodio: 'A', urlDrive: 'https://example.com/a' }, { tituloEpisodio: 'B', urlDrive: 'https://example.com/b' }] }] }], 'playlist.json');
    const eps = series.temporadas[0].episodios;
    const [reloaded] = C.identify([{ ...series, temporadas: [{ ...series.temporadas[0], episodios: eps.slice().reverse() }] }], 'playlist.json');
    assert.equal(reloaded.temporadas[0].episodios[0].id, eps[1].id);
    assert.deepEqual(eps[0].legacyIds, ['ep-0-0-0']);
});
test('draft summarizes additions, edits and removals and keeps rollback data', () => {
    const before = baseline(), after = structuredClone(before);
    after['peliculas.json'][0].descripcion = 'Edición de prueba';
    after['peliculas.json'].pop();
    after['peliculas.json'].push({ id: 'new-test', titulo: 'Nueva', urlDrive: 'https://example.com/new' });
    const draft = C.makeDraft(before, after), row = draft.summary.find(row => row.file === 'peliculas.json');
    assert.equal(row.added, 1); assert.equal(row.modified, 1); assert.equal(row.removed, 1);
    assert.equal(draft.published, false); assert.equal(draft.mode, 'draft');
    assert.deepEqual(draft.baseline, before);
    assert.equal(C.summarize(before, before).every(row => !row.added && !row.modified && !row.removed), true);
});
test('failed downloads reject instead of returning an empty catalog', async () => {
    let count = 0;
    await assert.rejects(C.read('peliculas.json', async () => { count++; return { ok: false, status: 403 }; }), /descarga fallida/);
    assert.equal(count, 1);
    await assert.rejects(C.read('peliculas.json', async () => ({ ok: true, status: 200, text: async () => '<html>Error</html>' })), /peliculas.json/);
});
test('remote fallback uses shared repository and branch only on a local 404', async () => {
    const old = { ...C.config }, calls = [];
    C.config.repository = 'example/catalog'; C.config.branch = 'draft/review';
    const data = await C.read('peliculas.json', async url => {
        calls.push(url);
        return calls.length === 1 ? { ok: false, status: 404 } : { ok: true, status: 200, text: async () => '[{"titulo":"A","urlDrive":"https://example.com/a"}]' };
    });
    Object.assign(C.config, old);
    assert.equal(data.length, 1);
    assert.match(calls[1], /example\/catalog\/draft%2Freview\/peliculas.json$/);
});
test('validation catches empty catalogs, duplicated IDs and invalid episode links', () => {
    const datasets = baseline();
    datasets['peliculas.json'] = [];
    datasets['peliculas2.json'][1].id = datasets['peliculas2.json'][0].id;
    datasets['playlist.json'][0].temporadas[0].episodios[0].urlDrive = 'javascript:alert(1)';
    const errors = C.validate(datasets);
    assert(errors.some(error => error.includes('catálogo vacío')));
    assert(errors.some(error => error.includes('ID ausente o duplicado')));
    assert(errors.some(error => error.includes('episodio sin enlace válido')));
    assert.throws(() => C.makeDraft({}, datasets), /todos los catálogos/);
});
test('serialization preserves metadata and IDs, including episodes, tracks and TV', () => {
    const raw = baseline();
    const serialized = C.serializeAll({ movies: raw['peliculas.json'], estrenos: raw['peliculas2.json'], series: raw['playlist.json'], animados: raw['animados.json'], radios: raw['radios.json'], tudumList: raw['tudum.json'], videoteca: raw['videoteca.json'], channels: C.parseM3U(raw['listaoficial.m3u']) });
    assert.equal(serialized['peliculas.json'][0].id, raw['peliculas.json'][0].id);
    assert.equal(serialized['peliculas.json'][0].tmdbId, raw['peliculas.json'][0].tmdbId);
    assert.deepEqual(serialized['playlist.json'][0], raw['playlist.json'][0]);
    assert.equal(C.parseM3U(serialized['listaoficial.m3u'])[0].id, C.parseM3U(raw['listaoficial.m3u'])[0].id);
});
test('restoring legacy administration data reuses shared IDs without discarding edits', () => {
    const before = C.identify([{ titulo: 'A', descripcion: 'Original', urlDrive: 'https://example.com/a' }], 'peliculas.json');
    const restored = C.restoreLocal([{ titulo: 'A', descripcion: 'Mi borrador', urlDrive: 'https://example.com/a', id: 'mov-0' }], before, 'peliculas.json');
    assert.equal(restored[0].id, before[0].id);
    assert.equal(restored[0].descripcion, 'Mi borrador');
    assert.deepEqual(restored[0].legacyIds, ['mov-1-0']);
});
test('catalog administration excludes the legacy GitHub token storage and direct writes', () => {
    const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
    assert(!admin.includes('api.github.com'));
    assert(!admin.includes('boxplay_github_pat'));
    assert(!admin.includes('Authorization'));
    assert(!/method:\s*['"](?:PUT|POST|PATCH|DELETE)['"]/.test(admin));
});
