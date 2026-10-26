const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = () => import('data:text/javascript;base64,' + fs.readFileSync(require('node:path').join(__dirname, '../app-openings.js')).toString('base64'));
test('heartbeats and concurrent validations count once; reopening counts again', async () => {
    const { createOpeningRecorder } = await load();
    const stored = new Map(); let writes = 0, id = 0;
    const options = { db: {}, doc: (_, collection, key) => collection + '/' + key,
        setDoc: async (key, data) => { writes++; stored.set(key, data); }, randomId: () => String(++id) };
    const record = createOpeningRecorder(options);
    await Promise.all(Array.from({ length: 8 }, () => record(' User@example.com ', 'device')));
    await record('user@example.com', 'device');
    assert.equal(writes, 1);
    await createOpeningRecorder(options)('user@example.com', 'device');
    await record('other@example.com', 'device');
    assert.equal(stored.size, 3);
    assert.equal(stored.get('aperturas/1').email, 'user@example.com');
});
test('ambiguous failure retries the same event and retains its day across midnight', async () => {
    const { createOpeningRecorder } = await load();
    let time = new Date('2026-11-01T05:59:59Z'), attempts = 0;
    const stored = new Map();
    const record = createOpeningRecorder({ db: {}, doc: (_, collection, id) => collection + '/' + id,
        randomId: () => 'same-id', now: () => time,
        setDoc: async (key, data) => { stored.set(key, data); if (++attempts === 1) throw Error('lost acknowledgement'); } });
    await assert.rejects(record('user@example.com', 'device'));
    time = new Date('2026-11-01T06:00:01Z');
    await record('user@example.com', 'device');
    assert.equal(stored.size, 1);
    assert.equal(stored.values().next().value.day, '2026-10-31');
    await assert.rejects(record('', 'device'));
});
test('Costa Rica day boundary is 06:00 UTC, including new year', async () => {
    const { costaRicaDay } = await load();
    assert.equal(costaRicaDay(new Date('2027-01-01T05:59:59Z')), '2026-12-31');
    assert.equal(costaRicaDay(new Date('2027-01-01T06:00:00Z')), '2027-01-01');
});
test('Smart TV launch validates remembered accounts; rejected accounts never create openings', async () => {
    const vm = require('node:vm');
    const { createOpeningRecorder } = await load();
    const auth = fs.readFileSync(require('node:path').join(__dirname, '../smart-tv-auth.js'), 'utf8').replace(/^import .*;\n/gm, '');
    for (const active of [true, false]) {
        const writes = []; const timers = [];
        const sandbox = {
            createOpeningRecorder, initializeApp: () => ({}), getFirestore: () => ({}),
            doc: (_, collection, id) => ({ collection, id }),
            setDoc: async (ref, data) => { writes.push({ ref, data }); },
            runTransaction: async (_, callback) => callback({
                get: async () => ({ exists: () => true, data: () => ({ status: active ? 'active' : 'expired', expires_at: '2028-01-01', devices: ['device'] }) }),
                update: () => {}
            }),
            localStorage: { getItem: key => key === 'boxplay_device_id' ? 'device' : 'a@example.com', setItem: () => {} },
            window: {}, document: { hidden: false, addEventListener: () => {} },
            setInterval: fn => timers.push(fn), console
        };
        vm.runInNewContext(auth, sandbox);
        await new Promise(resolve => setImmediate(resolve));
        await sandbox.window.boxTVAuth.verify('a@example.com');
        if (active) await timers[0]();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(writes.filter(item => item.ref.collection === 'aperturas').length, active ? 1 : 0);
    }
});
