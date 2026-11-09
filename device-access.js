// Una transacción decide la primera vinculación de un acceso, tanto en web como en TV.
export async function verifyDeviceAccess({ db, doc, runTransaction }, address, deviceId) {
    const email = String(address || '').trim().toLowerCase();
    const device = String(deviceId || '').trim();
    if (!email) return { activo: false, razon: 'no_existe' };
    if (!device) return { activo: false, razon: 'dispositivo_no_autorizado' };
    return runTransaction(db, async transaction => {
        const ref = doc(db, 'suscripciones', email);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) return { activo: false, razon: 'no_existe' };
        const data = snapshot.data(), expiration = new Date(data.expires_at).getTime();
        if (data.status !== 'active' || !Number.isFinite(expiration) || Date.now() >= expiration) {
            return { activo: false, razon: 'vencida', expiresAt: Number.isFinite(expiration) ? new Date(expiration).toISOString() : null };
        }
        const devices = Array.isArray(data.devices) ? data.devices : [];
        if (devices.length && !devices.includes(device)) return { activo: false, razon: 'dispositivo_no_autorizado' };
        if (!devices.length) transaction.update(ref, { devices: [device] });
        return { activo: true, razon: 'ok', expiresAt: new Date(expiration).toISOString(), ...(!devices.length ? { primerDispositivo: true } : {}) };
    });
}
