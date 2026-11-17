(() => {
    'use strict';
    const form = document.getElementById('box-contact-form');
    if (!form) return;
    const send = document.getElementById('contact-send');
    const status = document.getElementById('contact-status');
    const success = document.getElementById('contact-success');
    const another = document.getElementById('contact-another');
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

    // Also supports a normal HTML POST if JavaScript is unavailable.
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

    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending) return;
        for (const field of ['name', 'email', 'message']) {
            const input = form.elements.namedItem(field);
            input.value = input.value.trim();
        }
        if (!form.reportValidity()) return;
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
        showStatus('sending', 'Enviando tu consulta…');
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 20000);
        try {
            const data = Object.fromEntries(new FormData(form));
            const endpoint = new URL(form.action);
            endpoint.pathname = '/ajax' + endpoint.pathname;
            const response = await window.fetch(endpoint.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            const result = await response.json();
            // The provider also returns HTTP 200 with success="false" on rejection.
            if (!response.ok || (result.success !== true && result.success !== 'true') || /activat|actived|confirm.{0,30}email/i.test(String(result.message || ''))) {
                const activation = /activat|actived/i.test(String(result.message || ''));
                showStatus('error', activation
                    ? 'El formulario está pendiente de activación. Tu mensaje sigue aquí; inténtalo más tarde.'
                    : 'No se pudo confirmar el envío. Tu texto sigue aquí. Inténtalo de nuevo en unos minutos.');
                return;
            }
            showSuccess();
        } catch (_) {
            showStatus('error', 'No pudimos confirmar el envío. Tu texto sigue aquí. Revisa tu conexión antes de volver a intentarlo.');
        } finally {
            window.clearTimeout(timer);
            sending = false;
            send.disabled = false;
            send.textContent = 'Enviar mensaje';
            form.removeAttribute('aria-busy');
        }
    });
})();
