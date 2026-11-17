const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../contacto.js'), 'utf8');

function setup({ result = { success: 'true' }, ok = true, online = true, valid = true, fetcher, href = 'https://boxplaytv.com/contacto.html' } = {}) {
    const calls = [], listeners = {}, timers = new Map();
    const input = value => ({ value, focus() { this.focused = true; } });
    const fields = {
        name: input(' Jorge de prueba '), email: input(' sejo48@gmail.com '),
        message: input(' Consulta de prueba desde BOXPLAYTV. '), _honey: input(''),
        _subject: input('Correo de BOXPLAYTV · Nuevo mensaje'),
        _url: input('https://boxplaytv.com/contacto.html'), _next: input('https://boxplaytv.com/contacto.html?enviado=1')
    };
    const status = { dataset: {}, hidden: true };
    const send = { disabled: false, textContent: 'Enviar mensaje' };
    const success = { hidden: true, focus() { this.focused = true; } };
    const another = { addEventListener(type, fn) { listeners.another = fn; } };
    const mail = { href: 'mailto:sejo48@gmail.com', addEventListener(type, fn) { listeners.mail = fn; } };
    const form = {
        action: 'https://formsubmit.co/sejo48@gmail.com', hidden: false,
        elements: { namedItem: name => fields[name] },
        addEventListener(type, fn) { listeners[type] = fn; },
        reportValidity: () => valid,
        setAttribute() {}, removeAttribute() {},
        reset() { this.resetCalled = true; }
    };
    const nodes = { 'box-contact-form': form, 'contact-send': send, 'contact-status': status, 'contact-success': success, 'contact-another': another, 'contact-mail': mail };
    const window = {
        fetch: async (url, options) => {
            calls.push({ url, options });
            return fetcher ? fetcher(url, options) : { ok, json: async () => result };
        },
        AbortController, location: { href },
        history: { replaceState(_, __, url) { window.returnUrl = url; } },
        setTimeout(fn, delay) { timers.set(delay, fn); return delay; },
        clearTimeout(id) { timers.delete(id); }
    };
    vm.runInNewContext(source, { window, document: { getElementById: id => nodes[id] }, navigator: { onLine: online }, URL, URLSearchParams, AbortController,
        FormData: class { constructor() { return Object.entries(fields).map(([name, field]) => [name, field.value]); } }
    });
    const event = () => ({ defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
    return { form, fields, send, status, success, calls, listeners, window, timers, mail, event, submit: () => listeners.submit(event()) };
}

test('confirmed send keeps the agreed destination and subject with no JSON preflight', async () => {
    const ui = setup();
    await ui.submit();
    const call = ui.calls[0];
    assert.equal(call.url, 'https://formsubmit.co/ajax/sejo48@gmail.com');
    assert.equal(call.options.headers.Accept, 'application/json');
    assert.equal(call.options.headers['Content-Type'], undefined);
    assert.ok(call.options.body instanceof URLSearchParams);
    assert.equal(call.options.body.get('_subject'), 'Correo de BOXPLAYTV · Nuevo mensaje');
    assert.equal(call.options.body.get('email'), 'sejo48@gmail.com');
    assert.equal(call.options.body.has('_next'), false);
    assert.equal(ui.form.hidden, true);
    assert.equal(ui.form.resetCalled, true);
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.success.focused, true);
    ui.listeners.another();
    assert.equal(ui.form.hidden, false);
    assert.equal(ui.success.hidden, true);
});

for (const [label, options] of [
    ['provider string false with HTTP 200', { result: { success: 'false' } }],
    ['provider boolean false', { result: { success: false } }],
    ['HTTP 500 with a misleading success value', { ok: false }],
    ['activation pending', { result: { success: 'true', message: 'Check email to activate your form' } }],
    ['network failure', { fetcher: async () => { throw new Error('network'); } }],
    ['HTML response instead of JSON', { fetcher: async () => ({ ok: true, json: async () => { throw new Error('Unexpected HTML'); } }) }]
]) {
    test(label + ' preserves text and never claims delivery or retries automatically', async () => {
        const ui = setup(options);
        await ui.submit();
        assert.equal(ui.form.hidden, false);
        assert.equal(ui.form.resetCalled, undefined);
        assert.equal(ui.success.hidden, true);
        assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
        assert.equal(ui.status.dataset.state, 'error');
        assert.match(ui.status.textContent, /Enviar desde mi correo/);
        assert.equal(ui.send.disabled, false);
        assert.equal(ui.calls.length, 1);
        assert.equal(ui.mail.href, 'mailto:sejo48@gmail.com');
    });
}

test('offline, invalid and honeypot submissions do not send', async () => {
    for (const options of [{ online: false }, { valid: false }, {}]) {
        const ui = setup(options);
        if (Object.keys(options).length === 0) ui.fields._honey.value = 'bot';
        await ui.submit();
        assert.equal(ui.calls.length, 0);
        assert.equal(ui.success.hidden, true);
    }
});

test('a slow submission stays pending, suppresses duplicates and waits for confirmation', async () => {
    let finish;
    const ui = setup({ fetcher: () => new Promise(resolve => { finish = resolve; }) });
    const request = ui.submit();
    await ui.submit();
    ui.timers.get(15000)();
    assert.equal(ui.status.dataset.state, 'sending');
    assert.equal(ui.success.hidden, true);
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.send.disabled, true);
    const mailEvent = ui.event();
    ui.listeners.mail(mailEvent);
    assert.equal(mailEvent.defaultPrevented, true);
    finish({ ok: true, json: async () => ({ success: true }) });
    await request;
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.timers.size, 0);
});

test('timeout preserves the draft, acknowledges uncertain delivery, and does not resend', async () => {
    const ui = setup({ fetcher: (_, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('timeout')));
    }) });
    const request = ui.submit();
    ui.timers.get(90000)();
    await request;
    assert.equal(ui.success.hidden, true);
    assert.match(ui.status.textContent, /podría haber llegado/);
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
});

test('mail alternative opens a complete draft without claiming that it has been sent', () => {
    const ui = setup();
    const e = ui.event();
    ui.listeners.mail(e);
    assert.equal(e.defaultPrevented, false);
    const uri = new URL(ui.mail.href);
    assert.equal(uri.protocol, 'mailto:');
    assert.equal(uri.pathname, 'sejo48@gmail.com');
    assert.equal(uri.searchParams.get('subject'), 'Correo de BOXPLAYTV · Nuevo mensaje');
    assert.match(uri.searchParams.get('body'), /Nombre: Jorge de prueba\nCorreo: sejo48@gmail.com\n\nConsulta/);
    assert.equal(ui.calls.length, 0);
    assert.equal(ui.form.resetCalled, undefined);
    assert.equal(ui.success.hidden, true);
    assert.match(ui.status.textContent, /tocar Enviar/);
});

test('successful native return clears the flag and confirms delivery', () => {
    const ui = setup({ href: 'https://boxplaytv.com/contacto.html?enviado=1' });
    assert.equal(ui.window.returnUrl, '/contacto.html');
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.form.hidden, true);
});
