(() => {
    'use strict';
    const form = document.getElementById('box-contact-form');
    if (!form) return;
    const send = document.getElementById('contact-send');
    const status = document.getElementById('contact-status');
    const success = document.getElementById('contact-success');
    const another = document.getElementById('contact-another');
    let sending = false;

    const showStatus = message => {
        status.textContent = message;
        status.hidden = false;
    };
    const resetSending = () => {
        sending = false;
        send.disabled = false;
        send.textContent = 'Enviar mensaje';
        form.removeAttribute('aria-busy');
        status.hidden = true;
    };

    // Only the provider's successful POST returns to this confirmation URL.
    // Native navigation avoids a cross-origin fetch acknowledgement and its timeout.
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get('enviado') === '1') {
        currentUrl.searchParams.delete('enviado');
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
        form.reset();
        form.hidden = true;
        success.hidden = false;
        success.focus();
    }

    another.addEventListener('click', () => {
        success.hidden = true;
        form.hidden = false;
        resetSending();
        form.elements.namedItem('name').focus();
    });

    // Returning with Back after a network/provider error preserves the entered
    // fields. Re-enable the form even when the browser restores it from BFCache.
    window.addEventListener('pageshow', resetSending);

    form.addEventListener('submit', event => {
        if (sending) {
            event.preventDefault();
            return;
        }
        for (const field of ['name', 'email', 'message']) {
            const input = form.elements.namedItem(field);
            input.value = input.value.trim();
        }
        if (!form.reportValidity()) {
            event.preventDefault();
            return;
        }
        if (form.elements.namedItem('_honey').value) {
            event.preventDefault();
            status.dataset.state = 'error';
            showStatus('No se pudo enviar la consulta. Recarga la página e intenta de nuevo.');
            return;
        }
        if (navigator.onLine === false) {
            event.preventDefault();
            status.dataset.state = 'error';
            showStatus('No hay conexión a Internet. Tu texto sigue aquí; envíalo cuando vuelva la conexión.');
            return;
        }

        sending = true;
        send.disabled = true;
        send.textContent = 'Enviando…';
        form.setAttribute('aria-busy', 'true');
        status.dataset.state = 'sending';
        showStatus('Estamos enviando tu consulta. Al finalizar volverás a BOXPLAYTV.');
        // Allow the browser's normal POST. No automatic fallback/retry can
        // duplicate an email already accepted by the provider.
    });
})();
