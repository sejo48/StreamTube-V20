const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../catalog.js');
const N = require('../notices.js');
const NOW = Date.parse('2030-01-01T12:00:00Z');
const fresh = (id, expiresAt = '2030-01-08T12:00:00Z') => N.create({ id, title: 'Estreno 🎬', message: 'Películas y series: ₡3.000.', target: 'movies', expiresAt }, new Date(NOW - 1000).toISOString());
test('feed filters future and expired notices and counts only unread revisions', () => {
    const current = fresh('current'), expired = fresh('old', '2030-01-01T11:59:59.500Z');
    const future = { ...fresh('future'), createdAt: '2030-01-02T12:00:00Z' };
    const items = N.active({ schemaVersion: 1, notices: [current, expired, future] }, NOW);
    assert.deepEqual(items.map(n => n.id), ['current']);
    assert.equal(N.unread(items, []).length, 1);
    assert.equal(N.unread(items, [N.revision(current)]).length, 0);
    const edited = { ...current, updatedAt: '2030-01-01T13:00:00Z' };
    assert.equal(N.unread([edited], [N.revision(current)]).length, 1);
});
test('invalid content, duplicated IDs, dates and arbitrary destinations are rejected', () => {
    const notice = fresh('test');
    for (const item of [{ ...notice, target: 'https://example.com' }, { ...notice, message: '' }, { ...notice, title: 'X'.repeat(121) }, { ...notice, expiresAt: 'bad-date' }]) assert.throws(() => N.validate({ schemaVersion: 1, notices: [item] }));
    assert.throws(() => N.validate({ schemaVersion: 1, notices: [notice, notice] }));
});
test('UTF-8 payload survives publication encoding without losing accents or emoji', () => {
    const feed = { schemaVersion: 1, notices: [fresh('unicode')] };
    assert.deepEqual(N.decode(N.encode(feed)), feed);
});
test('badge sets exact count, clears zero, and tolerates unsupported phones or denial', async () => {
    const calls = [];
    const navigator = { setAppBadge: async n => calls.push(n), clearAppBadge: async () => calls.push('clear') };
    assert.equal(await N.badge(2, navigator), true);
    assert.equal(await N.badge(0, navigator), true);
    assert.deepEqual(calls, [2, 'clear']);
    assert.equal(await N.badge(2, {}), false);
    assert.equal(await N.badge(2, { setAppBadge: async () => { throw new Error('Permission denied'); } }), false);
});
test('repository requires a valid current SHA and publication writes only avisos.json', async () => {
    const feed = { schemaVersion: 1, notices: [fresh('one')] }, requests = [];
    const fetcher = async (url, options) => {
        requests.push([url, options]);
        if (options.method === 'PUT') return { ok: true, json: async () => ({ commit: { sha: 'commit' }, content: { sha: 'next' } }) };
        return { ok: true, json: async () => ({ sha: 'current', encoding: 'base64', content: N.encode(feed) }) };
    };
    const current = await N.repository('example-test-credential', fetcher);
    assert.equal(current.sha, 'current');
    await N.publish({ token: 'example-test-credential', feed, sha: current.sha }, fetcher);
    const [url, options] = requests[1];
    assert.equal(url, 'https://api.github.com/repos/sejo48/StreamTube-V20/contents/avisos.json');
    const body = JSON.parse(options.body);
    assert.equal(body.branch, 'main'); assert.equal(body.sha, 'current');
    assert.deepEqual(N.decode(body.content), feed);
    assert(!JSON.stringify(body).includes('example-test-credential'));
    await assert.rejects(N.publish({ token: 'example-test-credential', feed, sha: '' }, fetcher), /versión actual/);
});
test('access failure and concurrent edits stop publication instead of overwriting', async () => {
    const feed = { schemaVersion: 1, notices: [fresh('one')] };
    await assert.rejects(N.repository('example-test-credential', async () => ({ ok: false, status: 403 })), /permiso/);
    await assert.rejects(N.publish({ token: 'example-test-credential', feed, sha: 'old' }, async () => ({ ok: false, status: 409 })), /cambiaron/);
    await assert.rejects(N.load(async () => ({ ok: false, status: 503 })), /actualizar/);
});
