/* BOXPLAYTV: Google Cast sender, with no URL scraping or credential forwarding. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.BoxCast = { ...api, ...api.createController(root) }; root.BoxCast.initialize(); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const TYPES = { mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',ogg:'video/ogg',ogv:'video/ogg',m3u8:'application/x-mpegURL',mpd:'application/dash+xml' };
    function safeURL(value) {
        try { const url = new URL(String(value || '').trim()); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null; } catch (_) { return null; }
    }
    function mediaFor(url, item = {}, episode = null) {
        const parsed = safeURL(url);
        const base = { url: parsed?.href || '', title: episode?.title || episode?.tituloEpisodio || item.title || item.titulo || item.name || 'BOXPLAYTV', subtitle: episode ? item.title || item.titulo || 'BOXPLAYTV' : 'BOXPLAYTV', poster: safeURL(item.image || item.imagen || item.poster)?.href || '', live: item.type === 'tv' };
        if (!parsed) return { ...base, supported:false,reason:'invalid',message:'El enlace del video no es válido para transmitir.' };
        if (/(^|\.)drive\.google\.com$/.test(parsed.hostname) || parsed.hostname === 'docs.google.com') return { ...base,supported:false,reason:'drive',message:'Este video utiliza el reproductor de Google Drive. Para verlo en el TV, utiliza la duplicación de pestaña o de pantalla que se explica abajo.' };
        if (/(^|\.)(ok\.ru|odnoklassniki\.ru)$/.test(parsed.hostname)) return { ...base,supported:false,reason:'ok',message:'Este video utiliza el reproductor de OK.ru. Para verlo en el TV, utiliza la duplicación de pestaña o de pantalla que se explica abajo.' };
        const extension = parsed.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
        const explicit = String(item.contentType || item.mimeType || '').split(';')[0].trim();
        // HTML/preview pages must never be passed to a media receiver as video.
        const mime = TYPES[extension] || (!/\.(html?|php|aspx?)$/i.test(parsed.pathname) && Object.values(TYPES).includes(explicit) ? explicit : '');
        return mime ? { ...base,supported:true,mime,reason:'direct' } : { ...base,supported:false,reason:'unknown',message:'Este enlace no identifica un archivo de video compatible. Puedes usar la duplicación de pantalla.' };
    }
    function createController(env) {
        const subscribers = new Set();
        let context = null, remote = null, controls = null, initialized = false, timer = null, operation = 0, pendingURL = '', pendingStage = '';
        let state = { ready:false,connected:false,casting:false,loading:false,device:'',contentId:'',paused:false,currentTime:0,duration:0,volume:1,canSeek:false,error:'',status:'starting' };
        const getState = () => ({ ...state });
        const update = patch => { const next = { ...state,...patch }; if (JSON.stringify(next) === JSON.stringify(state)) return; state = next; subscribers.forEach(fn => fn(getState())); };
        const subscribe = fn => { subscribers.add(fn); return () => subscribers.delete(fn); };
        const session = () => context?.getCurrentSession() || null;
        const refresh = () => {
            const active = session();
            if (!active) { update({ connected:false,casting:false,contentId:'',device:'',currentTime:0,duration:0,canSeek:false }); return; }
            const media = active.getMediaSession?.();
            const info = media?.media || remote?.mediaInfo;
            const id = !state.loading && remote?.isMediaLoaded === false ? '' : info?.contentId || '';
            update({ connected:true,device:active.getCastDevice?.()?.friendlyName || 'Televisor',casting:!!id,contentId:id,paused:!!remote?.isPaused,currentTime:Number(remote?.currentTime || 0),duration:Number(remote?.duration || 0),volume:remote?.volumeLevel ?? 1,canSeek:!!remote?.canSeek,status:'ready' });
        };
        function connectSDK() {
            if (context) return true;
            if (!env.cast?.framework || !env.chrome?.cast?.media) return false;
            try {
                const framework = env.cast.framework;
                context = framework.CastContext.getInstance();
                context.setOptions({ receiverApplicationId:env.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,autoJoinPolicy:env.chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED });
                context.addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, refresh);
                context.addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, event => {
                    if (event.sessionState === framework.SessionState.SESSION_ENDED || event.sessionState === framework.SessionState.SESSION_START_FAILED) { operation++; update({loading:false}); }
                    refresh();
                });
                remote = new framework.RemotePlayer();
                controls = new framework.RemotePlayerController(remote);
                controls.addEventListener(framework.RemotePlayerEventType.ANY_CHANGE, refresh);
                if (timer) env.clearTimeout(timer);
                update({ ready:true,status:'ready',error:'' }); refresh(); return true;
            } catch (_) { context = null; update({ ready:false,status:'unavailable',error:'No se pudo preparar Google Cast. Utiliza Chrome actualizado o la duplicación de pantalla.' }); return false; }
        }
        function initialize() {
            if (initialized) return;
            initialized = true;
            if (env.location && env.location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(env.location.hostname)) { update({status:'unavailable',error:'Abre BOXPLAYTV con HTTPS para utilizar Google Cast.'});return; }
            const previous = env.__onGCastApiAvailable;
            env.__onGCastApiAvailable = available => {
                if (typeof previous === 'function') { try { previous(available); } catch (_) {} }
                if (available) connectSDK(); else update({ ready:false,status:'unavailable',error:'Google Cast no está disponible en este navegador. Abre BOXPLAYTV en Chrome o utiliza la duplicación de pantalla.' });
            };
            if (connectSDK()) return;
            timer = env.setTimeout(() => { if (!state.ready) update({ status:'unavailable',error:'No se ha podido cargar Google Cast. Revisa Internet, utiliza Chrome o consulta las opciones de duplicación.' }); },12000);
        }
        function messageFor(error) {
            const code = error?.code || error;
            if (code === 'timeout') return 'El televisor tardó demasiado en responder. Revisa la conexión y vuelve a intentarlo.';
            if (code === 'receiver_unavailable' || code === 'session_error') return 'No se pudo conectar. Comprueba que el TV tenga Google Cast y esté en la misma red Wi-Fi.';
            return 'El televisor no pudo abrir este video. El formato, los permisos o el servidor pueden impedirlo. Prueba la duplicación de pantalla.';
        }
        async function send(media, position = 0) {
            if (!media?.supported || !safeURL(media.url)) throw Error(media?.message || 'El video no es compatible con envío directo.');
            const verified = mediaFor(media.url,{contentType:media.mime});
            if (!verified.supported) throw Error(verified.message);
            if (!state.ready || !context) throw Error(state.error || 'Google Cast aún está cargando. Inténtalo de nuevo en unos segundos.');
            if (state.loading) return { busy:true };
            const requestId = ++operation;
            pendingURL = media.url; pendingStage = 'choosing';
            update({ loading:true,error:'' });
            try {
                // requestSession is called before awaiting so the device chooser retains the click gesture.
                let active = session();
                const choosingNewSession = !active;
                if (!active) { await context.requestSession(); active = session(); }
                if (!active || requestId !== operation) {
                    if (active && choosingNewSession && !state.loading && !state.casting) active.endSession(true);
                    return { cancelled:true };
                }
                const api = env.chrome.cast.media;
                const info = new api.MediaInfo(media.url,media.mime);
                info.streamType = media.live ? api.StreamType.LIVE : api.StreamType.BUFFERED;
                const metadata = new api.MovieMediaMetadata();
                metadata.title = media.title; metadata.subtitle = media.subtitle;
                if (media.poster && safeURL(media.poster)) metadata.images = [new env.chrome.cast.Image(media.poster)];
                info.metadata = metadata;
                const request = new api.LoadRequest(info);
                request.autoplay = true;
                request.currentTime = media.live ? 0 : Math.max(0,Number(position) || 0);
                pendingStage = 'loading';
                await active.loadMedia(request);
                if (requestId !== operation) return { cancelled:true };
                update({ connected:true,casting:true,contentId:media.url,device:active.getCastDevice?.()?.friendlyName || 'Televisor',error:'' });
                return { sent:true };
            } catch (error) {
                if (requestId !== operation) return { cancelled:true };
                if ((error?.code || error) === 'cancel') { update({ error:'' }); return { cancelled:true }; }
                const text = messageFor(error); update({ error:text }); throw Error(text);
            } finally { if (requestId === operation) { pendingURL = ''; pendingStage = ''; update({ loading:false }); } }
        }
        function cancelPending(url) {
            if (!state.loading || pendingURL !== url) return;
            operation++;
            const loadingMedia = pendingStage === 'loading';
            pendingURL = ''; pendingStage = '';
            if (loadingMedia) { stop(); return; }
            update({loading:false});
        }
        function stop() {
            operation++;
            pendingURL = ''; pendingStage = '';
            const active = session();
            if (active) { try { active.endSession(true); } catch (_) {} }
            update({ connected:false,casting:false,loading:false,contentId:'',device:'',currentTime:0,duration:0,error:'' });
        }
        const playPause = () => { if (session() && state.casting) controls?.playOrPause(); };
        const seek = value => { if (session() && remote?.canSeek) { remote.currentTime = Math.max(0,Math.min(Number(value)||0,remote.duration||0)); controls.seek(); } };
        const setVolume = value => { if (session() && remote) { remote.volumeLevel = Math.max(0,Math.min(Number(value)||0,1)); controls.setVolumeLevel(); } };
        return { initialize,getState,subscribe,send,cancelPending,stop,playPause,seek,setVolume };
    }
    return { safeURL,mediaFor,createController };
});
