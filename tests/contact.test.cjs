const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../contacto.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../contacto.html'), 'utf8');

function setup({ online = true, valid = true, href = 'https://boxplaytv.com/contacto.html' } = {}) {
    const listeners = {}, browserEvents = {};
    const input = value => ({ value, focus() { this.focused = true; } });
    const fields = {
        name: input(' Jorge de prueba '), email: input(' sejo48@gmail.com '),
        message: input(' Consulta de prueba desde BOXPLAYTV. '), _honey: input('')
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
        location: { href },
        history: { replaceState(_, __, url) { window.returnUrl = url; } },
        addEventListener(type, fn) { browserEvents[type] = fn; },
        fetch() { throw new Error('Email submission must not depend on Fetch'); },
        setTimeout() { throw new Error('Do not time out an email already being sent'); }
    };
    vm.runInNewContext(source, { window, document: { getElementById: id => nodes[id] }, navigator: { onLine: online }, URL });
    const submit = () => {
        const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
        listeners.submit(event);
        return event;
    };
    return { form, fields, send, status, success, listeners, browserEvents, window, submit };
}

test('native POST uses the agreed destination, subject and return URL without JavaScript', () => {
    assert.match(html, /action="https:\/\/formsubmit\.co\/sejo48@gmail\.com" method="POST"/);
    assert.match(html, /name="_subject" value="Correo de BOXPLAYTV · Nuevo mensaje"/);
    assert.match(html, /name="_next" value="https:\/\/boxplaytv\.com\/contacto\.html\?enviado=1"/);
    assert.match(html, /type="email" pattern=/);
    assert.doesNotMatch(html, /name="(?:phone|telefono)"/);
});

test('valid submission lets the browser POST, keeps the draft and awaits the real return', () => {
    const ui = setup();
    assert.equal(ui.submit().defaultPrevented, false);
    assert.equal(ui.fields.email.value, 'sejo48@gmail.com');
    assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
    assert.equal(ui.form.resetCalled, undefined);
    assert.equal(ui.form.hidden, false);
    assert.equal(ui.success.hidden, true);
    assert.equal(ui.send.disabled, true);
    assert.equal(ui.status.dataset.state, 'sending');
});

test('duplicate submit is cancelled without sending a second message', () => {
    const ui = setup();
    assert.equal(ui.submit().defaultPrevented, false);
    assert.equal(ui.submit().defaultPrevented, true);
    assert.equal(ui.success.hidden, true);
});

test('offline, invalid and honeypot submissions stay on the page without clearing text', () => {
    for (const options of [{ online: false }, { valid: false }, {}]) {
        const ui = setup(options);
        if (Object.keys(options).length === 0) ui.fields._honey.value = 'bot';
        assert.equal(ui.submit().defaultPrevented, true);
        assert.equal(ui.send.disabled, false);
        assert.equal(ui.form.resetCalled, undefined);
        assert.equal(ui.success.hidden, true);
        assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
    }
});

test('Back from a provider/network error restores the form without an automatic retry', () => {
    const ui = setup();
    ui.submit();
    ui.browserEvents.pageshow();
    assert.equal(ui.send.disabled, false);
    assert.equal(ui.status.hidden, true);
    assert.equal(ui.fields.message.value, 'Consulta de prueba desde BOXPLAYTV.');
    assert.equal(ui.form.resetCalled, undefined);
    assert.equal(ui.success.hidden, true);
    assert.equal(ui.submit().defaultPrevented, false);
});

test('only the successful return shows confirmation, then allows a new message', () => {
    const ui = setup({ href: 'https://boxplaytv.com/contacto.html?enviado=1' });
    assert.equal(ui.window.returnUrl, '/contacto.html');
    assert.equal(ui.form.hidden, true);
    assert.equal(ui.form.resetCalled, true);
    assert.equal(ui.success.hidden, false);
    assert.equal(ui.success.focused, true);
    ui.listeners.another();
    assert.equal(ui.form.hidden, false);
    assert.equal(ui.success.hidden, true);
    assert.equal(ui.send.disabled, false);
    assert.equal(ui.fields.name.focused, true);
});
