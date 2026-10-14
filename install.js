/* Capture the install request before React/CDN scripts finish loading. */
(() => {
    'use strict';
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const state = window.BoxPlayInstall = {
        prompt: null,
        installed: displayMode.matches || navigator.standalone === true
    };
    const notify = () => window.dispatchEvent(new Event('boxplay-install-change'));
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        state.prompt = event;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        state.prompt = null;
        state.installed = true;
        notify();
    });
    displayMode.addEventListener?.('change', event => {
        if (event.matches) { state.installed = true; notify(); }
    });
    state.consume = () => { state.prompt = null; notify(); };
    if ('serviceWorker' in navigator && window.isSecureContext) {
        navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { updateViaCache: 'none' })
            .catch(error => console.warn('No se pudo preparar la instalación de Box Play TV.', error));
    }
})();
