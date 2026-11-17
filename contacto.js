(() => {
    'use strict';
    const form = document.getElementById('box-contact-form');
    if (!form) return;
    const send = document.getElementById('contact-send');
    const status = document.getElementById('contact-status');
    const success = document.getElementById('contact-success');
    const another = document.getElementById('contact-another');
    const mail = document.getElementById('contact-mail');
    let sending = false;

    const showStatus = (state, message) => {
        status.dataset.state = state;
        status.textContent = message;
        status.hidden = false;
    };
    const showSuccess = () => {
        form.reset();
        form.hidden = true;
        success.hidden = false;
        success.focus();
    };
    const validate = () => {
        for (const field of ['name', 'email', 'message']) {
            const input = form.elements.namedItem(field);
            input.value = input.value.trim();
        }
        return form.reportValidity();
    };

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get('enviado') === '1') {
        currentUrl.searchParams.delete('enviado');
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
        showSuccess();
    }
    another.addEventListener('click', () => {
        success.hidden = true;
        form.hidden = false;
        status.hidden = true;
        form.elements.namedItem('name').focus();
    });

    // This opens a draft only. Delivery is never announced until confirmed.
    mail.addEventListener('click', event => {
        if (sending || !validate()) {
            event.preventDefault();
            return;
        }
        const value = name => form.elements.namedItem(name).value;
        const body = 'Nombre: ' + value('name') + '\nCorreo: ' + value('email') + '\n\n' + value('message');
        mail.href = 'mailto:sejo48@gmail.com?subject=' + encodeURIComponent('Correo de BOXPLAYTV · Nuevo mensaje') + '&body=' + encodeURIComponent(body);
        showStatus('sending', 'Se abrirá un borrador en tu aplicación de correo. Allí debes tocar Enviar para completar el envío.');
    });

    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || !validate()) return;
        if (form.elements.namedItem('_honey').value) {
            showStatus('error', 'No se pudo enviar la consulta. Recarga la página e intenta de nuevo.');
            return;
        }
        if (navigator.onLine === false) {
            showStatus('error', 'No hay conexión a Internet. Tu texto sigue aquí; envíalo cuando vuelva la conexión.');
            return;
        }

        sending = true;
        send.disabled = true;
        send.textContent = 'Enviando…';
        form.setAttribute('aria-busy', 'true');
        showStatus('sending', 'Enviando tu consulta. Espera la confirmación antes de volver a enviarla.');
        const controller = new AbortController();
        const slowTimer = window.setTimeout(() => showStatus('sending', 'El servicio está tardando en responder. Tu consulta sigue en proceso; no vuelvas a enviarla todavía.'), 15000);
        const timeout = window.setTimeout(() => controller.abort(), 90000);
        try {
            const data = new URLSearchParams(new FormData(form));
            data.delete('_next');
            const endpoint = new URL(form.action);
            endpoint.pathname = '/ajax' + endpoint.pathname;
            // URL-encoded browser form data avoids an unnecessary JSON preflight.
            const response = await window.fetch(endpoint.href, {
                method: 'POST', headers: { Accept: 'application/json' },
                body: data, signal: controller.signal
            });
            const result = await response.json();
            const activation = /activat|actived|confirm.{0,30}email/i.test(String(result && result.message || ''));
            if (!response.ok || !result || (result.success !== true && result.success !== 'true') || activation) {
                showStatus('error', activation
                    ? 'El servicio de contacto está pendiente de activación. Puedes usar «Enviar desde mi correo» para escribirnos.'
                    : 'El servicio de correo no confirmó el envío. Tu consulta podría haber llegado; espera unos minutos antes de repetirla. También puedes usar «Enviar desde mi correo».');
                return;
            }
            showSuccess();
        } catch (_) {
            showStatus('error', 'No recibimos la confirmación del servicio de correo. Tu consulta podría haber llegado; espera unos minutos antes de repetirla. También puedes usar «Enviar desde mi correo».');
        } finally {
            window.clearTimeout(slowTimer);
            window.clearTimeout(timeout);
            sending = false;
            send.disabled = false;
            send.textContent = 'Enviar mensaje';
            form.removeAttribute('aria-busy');
        }
    });
})();
