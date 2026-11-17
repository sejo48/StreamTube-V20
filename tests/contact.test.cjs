const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../contacto.js'), 'utf8');

function setup({ result = { success: 'true', message: 'Success' }, ok = true, online = true, fetcher, href = 'https://boxplaytv.com/contacto.html', valid = true, nativeOnly = false } = {}) {
    const calls = [], listeners = {};
    const input = value => ({ value, focus() { this.focused = true; } });
    const fields = {
        name: input(' Jorge de prueba '), email: input(' sejo48@gmail.com '),
        message: input(' Consulta de prueba desde BOXPLAYTV. '), _honey: input(''),
        _subject: input('Correo de BOXPLAYTV · Nuevo mensaje'), _template: input('table'),
        _url: input('https://boxplaytv.com/contacto.html')
    };
    const status = { dataset: {}, hidden: true };
    const send = { disabled: false, textContent: 'Enviar mensaje' };
    const success = { hidden: true, focus() { this.focused = true; } };
    const another = { addEventListener(type, fn) { listeners.another = fn; } };
    const form = {
        action: 'https://formsubmit.co/sejo48@gmail.com', hidden: false,
        elements: { namedItem: name => fields[name] },
        addEventListener(type, fn) { listeners[type] = fn; },
        reportValidity: () => valid,
        setAttribute() {}, removeAttribute() {},
        reset() { this.resetCalled = true; }
    };
    const nodes = { 'box-contact-form': form, 'contact-send': send, 'contact-status': status, 'contact-success': success, 'contact-another': another };
    const window = {
        fetch: nativeOnly ? undefined : async (url, options) => {
            calls.push({ url, options });
            if (fetcher) return fetcher(url, options);
            return { ok, json: async () => result };
        },
        AbortController, location: { href },
        history: { replaceState(_, __, url) { window.returnUrl = url; } },
        setTimeout, clearTimeout
    };
    const context = { window, document: { getElementById: id => nodes[id] }, navigator: { onLine: online }, URL, AbortController,
        FormData: class { constructor() { return Object.entries(fields).map(([name, field]) => [name, field.value]); } }
    };
    vm.runInNewContext(source, context);
    return { form, fields, send, status, success, calls, listeners, window, submit: () => listeners.submit({ preventDefault() {} }) };
}

test('confirmed send targets the agreed mailbox and subject, with reply email and no phone', async () => {
    const ui = setup();
    await ui.submit();
    assert.equal(ui.calls[0].url, 'https://formsubmit.co/ajax/sejo48@gmail.com');
    const body = JSON.parse(ui.calls[0].options.body);
    assert.equal(body.email, 'sejo48@gmail.com');
    assert.equal(body._subject, 'Correo de BOXPLAYTV · Nuevo mensaje');
    assert.equal(body.message, 'Consulta de prueba desde BOXPLAYTV.');
    assert.equal(Object.hasOwn(body, 'phone'), false);
    assert.equal(ui.form.hidden, true);
    assert.equal(ui.form.resetCalled, true);
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.success.focused, true);
    ui.listeners.another();
    assert.equal(ui.form.hidden, false);
    assert.equal(ui.success.hidden, true);
    assert.equal(ui.fields.name.focused, true);
});

for (const [label, options] of [
    ['provider string false with HTTP 200', { result: { success: 'false', message: 'Rejected' } }],
    ['provider boolean false', { result: { success: false } }],
    ['HTTP failure with a misleading success value', { ok: false }],
    ['activation pending', { result: { success: 'false', message: 'This form needs Activation' } }],
    ['activation pending with a misleading success value', { result: { success: 'true', message: 'Check email to activate your form' } }],
    ['network failure', { fetcher: async () => { throw new Error('offline'); } }],
    ['malformed provider response', { fetcher: async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }) }]
]) {
    test(label + ' preserves the draft and never announces delivery', async () => {
        const ui = setup(options);
        await ui.submit();
        assert.equal(ui.form.hidden, false);
        assert.equal(ui.form.resetCalled, undefined);
        assert.equal(ui.success.hidden, true);
        assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
        assert.equal(ui.status.dataset.state, 'error');
        assert.equal(ui.send.disabled, false);
        assert.equal(ui.calls.length, 1);
    });
}

test('offline, invalid fields and honeypot do not send email', async () => {
    for (const options of [{ online: false }, { valid: false }, {}]) {
        const ui = setup(options);
        if (Object.keys(options).length === 0) ui.fields._honey.value = 'bot';
        await ui.submit();
        assert.equal(ui.calls.length, 0);
        assert.equal(ui.success.hidden, true);
    }
});

test('double submit creates one request and unlocks the form after response', async () => {
    let finish;
    const ui = setup({ fetcher: () => new Promise(resolve => { finish = resolve; }) });
    const first = ui.submit();
    await ui.submit();
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.send.disabled, true);
    finish({ ok: true, json: async () => ({ success: true }) });
    await first;
    assert.equal(ui.send.disabled, false);
    assert.equal(ui.success.hidden, false);
});

test('native HTML fallback remains available without fetch', () => {
    const ui = setup({ nativeOnly: true });
    assert.equal(ui.listeners.submit, undefined);
    assert.equal(ui.form.hidden, false);
});

test('native success return clears its flag and displays the confirmation', () => {
    const ui = setup({ href: 'https://boxplaytv.com/contacto.html?enviado=1', nativeOnly: true });
    assert.equal(ui.window.returnUrl, '/contacto.html');
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.form.hidden, true);
});
