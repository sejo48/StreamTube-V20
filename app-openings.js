// One event per authorized subscriber per document load. Heartbeats may retry
// this recorder, but always reuse the same event ID and original opening date.
export function costaRicaDay(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function createOpeningRecorder({ db, doc, setDoc, randomId = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}, now = () => new Date() }) {
    const events = new Map();
    return function recordOpening(address, deviceId) {
        const email = String(address || '').trim().toLowerCase();
        if (!email || !deviceId) return Promise.reject(new Error('Falta el correo o dispositivo.'));
        let event = events.get(email);
        if (!event) {
            const openedAt = now();
            event = {
                id: randomId(), saved: false, pending: null,
                data: { email, deviceId, day: costaRicaDay(openedAt), openedAt: openedAt.toISOString() }
            };
            events.set(email, event);
        }
        if (event.saved) return Promise.resolve();
        if (event.pending) return event.pending;
        event.pending = Promise.resolve().then(() => setDoc(doc(db, 'aperturas', event.id), event.data))
            .then(() => { event.saved = true; })
            .finally(() => { event.pending = null; });
        return event.pending;
    };
}
