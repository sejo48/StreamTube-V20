const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = () => import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../device-access.js')).toString('base64'));
const subscription = overrides => ({ status: 'active', expires_at: '2099-01-01', devices: [], ...overrides });
function store(initial, fail = false) {
    let data = initial && structuredClone(initial), queue = Promise.resolve();
    return { get: () => data, db: {}, doc: (_, collection, email) => { assert.equal(collection, 'suscripciones'); assert.equal(email, 'a@test.com'); return email; },
        runTransaction(_, callback) {
            const result = queue.then(async () => {
                let draft = structuredClone(data);
                const value = await callback({ get: async () => ({ exists: () => !!draft, data: () => draft }), update: (_, patch) => { draft = { ...draft, ...patch }; } });
                if (fail) throw Error('permission-denied');
                data = draft; return value;
            }); queue = result.catch(() => {}); return result;
        } };
}
test('concurrent first registrations authorize just one device', async () => {
    const { verifyDeviceAccess } = await load(), context = store(subscription());
    const results = await Promise.all(['web-device', 'tv-device'].map(device => verifyDeviceAccess(context, ' A@TEST.COM ', device)));
    assert.equal(results.filter(result => result.activo).length, 1);
    assert.equal(context.get().devices.length, 1);
    assert.equal(results.find(result => !result.activo).razon, 'dispositivo_no_autorizado');
    assert((await verifyDeviceAccess(context, 'a@test.com', context.get().devices[0])).activo);
    assert.equal((await verifyDeviceAccess(context, 'a@test.com', 'other-device')).activo, false);
});
test('registration errors cannot grant access; invalid, expired and inactive records reject', async () => {
    const { verifyDeviceAccess } = await load();
    await assert.rejects(verifyDeviceAccess(store(subscription(), true), 'a@test.com', 'device'), /permission-denied/);
    for (const data of [null, subscription({ status: 'inactive' }), subscription({ expires_at: '2020-01-01' }), subscription({ expires_at: 'invalid' })]) {
        assert.equal((await verifyDeviceAccess(store(data), 'a@test.com', 'device')).activo, false);
    }
    assert.equal((await verifyDeviceAccess(store(subscription()), 'a@test.com', '')).activo, false);
});
test('web and TV use the shared transaction and metadata does not allow extra devices', async () => {
    const { verifyDeviceAccess } = await load();
    const context = store(subscription({ devices: ['authorized'], clientId: 'customer', accessName: 'TV', maxDevices: 5 }));
    assert.equal((await verifyDeviceAccess(context, 'a@test.com', 'another')).activo, false);
    assert.match(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), /return await verifyDeviceAccess\(\{ db, doc, runTransaction \}/);
    assert.match(fs.readFileSync(path.join(__dirname, '../smart-tv-auth.js'), 'utf8'), /verifyDeviceAccess\(\{db,doc,runTransaction\}/);
});
