/* Shared home-cover contract. Only references to the published Estrenos catalog are allowed. */
(function (root) {
    'use strict';
    const FILE = 'portadas-inicio.json', SOURCE = 'peliculas2.json';
    const automatic = () => ({ schemaVersion: 1, source: SOURCE, mode: 'automatic', items: [] });
    const title = item => String(item?.titulo || item?.title || item?.name || '').trim();
    const image = item => String(item && Object.prototype.hasOwnProperty.call(item,'panoramicImage') ? item.panoramicImage : item?.backdrop || item?.banner || '').trim();
    const validImage = value => { try { return typeof value === 'string' && value.length < 3000 && new URL(value).protocol === 'https:'; } catch { return false; } };
    function key(item) {
        if (/^[1-9]\d*$/.test(String(item.tmdbId || ''))) return 'tmdb:' + item.tmdbId;
        const source = String(item.urlDrive || item.urlOkRu || item.rawUrl || item.url || '').trim();
        if (source) {
            try {
                const url = new URL(source);
                if (url.hostname === 'drive.google.com') {
                    const driveId = (url.pathname.match(/\/d\/([\w-]+)/) || [])[1] || url.searchParams.get('id');
                    if (driveId) return 'drive:' + driveId;
                }
                return 'url:' + source;
            } catch { /* Older records may only have a title and year. */ }
        }
        return 'title:' + title(item).toLocaleLowerCase('es').replace(/\s+/g, ' ') + '|' + String(item.year || item.anio || '');
    }
    function validate(config) {
        if (!config || config.schemaVersion !== 1 || config.source !== SOURCE || !['automatic','manual'].includes(config.mode) || !Array.isArray(config.items)) throw new Error('Formato de portadas de inicio inválido.');
        if (config.mode === 'manual' ? config.items.length !== 5 : config.items.length !== 0) throw new Error('Selecciona exactamente cinco películas de Estrenos.');
        const seen = new Set();
        for (const item of config.items) {
            if (!item || typeof item.movieKey !== 'string' || !item.movieKey || item.movieKey.length > 3000 || seen.has(item.movieKey) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 300 || !validImage(item.backdrop)) throw new Error('Las cinco portadas deben ser distintas y tener un título e imagen HTTPS válidos.');
            seen.add(item.movieKey);
        }
        return config;
    }
    function make(items, now = new Date().toISOString()) {
        return validate({schemaVersion:1,source:SOURCE,mode:'manual',updatedAt:now,items:items.map(item=>({movieKey:item.movieKey || key(item),title:title(item),backdrop:image(item)}))});
    }
    const revision = config => {
        validate(config);
        return JSON.stringify([config.mode, config.updatedAt || '', config.items.map(item => [item.movieKey,item.title,item.backdrop])]);
    };
    function resolve(config, catalog) {
        validate(config);
        const movies = new Map((catalog || []).map(item => [key(item),item]));
        return config.items.flatMap(selection => {
            const item = movies.get(selection.movieKey);
            return item ? [{...item,panoramicImage:selection.backdrop}] : [];
        });
    }
    const checked = new Map();
    async function probe(url) {
        if (!validImage(url)) return null;
        if (checked.has(url)) return checked.get(url);
        return new Promise(resolve => {
            const img = new Image(); let timer;
            const finish = size => { clearTimeout(timer);img.onload=img.onerror=null;if(size)checked.set(url,size);resolve(size); };
            img.onload=()=>finish({width:img.naturalWidth,height:img.naturalHeight});
            img.onerror=()=>finish(null);timer=setTimeout(()=>finish(null),6000);img.src=url;
        });
    }
    const panoramic = size => !!size && size.height > 0 && size.width / size.height >= 1.5;
    async function destination() {
        if (root.BoxCatalog) await root.BoxCatalog.ready;
        return root.BoxNoticesConfig || root.BoxCatalog?.config || {repository:'sejo48/StreamTube-V20',branch:'main'};
    }
    async function publicFile(file, fetcher) {
        const {repository,branch} = await destination();
        const raw = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${file}`;
        const source = root.BoxNoticesConfig ? raw : './' + file;
        let response = await fetcher(source + '?t=' + Date.now(),{cache:'no-store'});
        if (response.status === 404 && source !== raw) response = await fetcher(raw + '?t=' + Date.now(),{cache:'no-store'});
        if (!response.ok) throw failure(response.status);
        return response.json();
    }
    async function read(fetcher = root.fetch.bind(root)) { return validate(await publicFile(FILE,fetcher)); }
    async function catalog(fetcher = root.fetch.bind(root)) {
        const value = await publicFile(SOURCE,fetcher);
        const items = Array.isArray(value) ? value : value?.peliculas || value?.peliculas2;
        if (!Array.isArray(items) || !items.length) throw new Error('No se pudo cargar el catálogo publicado de Estrenos.');
        const seen=new Set();return items.filter(item=>{if(!title(item))return false;const identity=key(item);if(seen.has(identity))return false;seen.add(identity);return true;});
    }
    function headers(token) {
        if (typeof token !== 'string' || !token.trim()) throw new Error('Introduce una credencial de GitHub y comprueba la conexión.');
        return {Authorization:'Bearer '+token.trim(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    }
    function failure(status) {
        const text = status === 401 ? 'GitHub rechazó el token. Sustitúyelo y comprueba la conexión.' : status === 403 ? 'GitHub denegó el acceso. Comprueba el permiso Contents: escritura en StreamTube-V20.' : status === 409 || status === 422 ? 'La selección publicada cambió. Carga la selección publicada antes de volver a guardar.' : status === 404 ? 'No se encontró la configuración de portadas o falta acceso a StreamTube-V20.' : 'No se confirmó la actualización de las portadas. Se conserva tu borrador; consulta la selección publicada antes de reintentar.';
        const error = new Error(text);error.status=status;return error;
    }
    function encode(value) { const bytes=new TextEncoder().encode(JSON.stringify(value,null,2));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return root.btoa(binary); }
    function decode(value) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(root.atob(value.replace(/\s/g,'')),character=>character.charCodeAt(0)))); }
    async function repository(token, fetcher = root.fetch.bind(root)) {
        const {repository,branch}=await destination();
        const response=await fetcher(`https://api.github.com/repos/${repository}/contents/${FILE}?ref=${encodeURIComponent(branch)}`,{headers:headers(token),cache:'no-store'});
        if(!response.ok)throw failure(response.status);
        const data=await response.json();
        if(typeof data.sha!=='string'||!data.sha||data.encoding!=='base64'||typeof data.content!=='string')throw new Error('GitHub no devolvió una versión válida de las portadas.');
        return {config:validate(decode(data.content)),sha:data.sha};
    }
    async function publish({token,config,sha},fetcher=root.fetch.bind(root)) {
        validate(config);if(!sha)throw new Error('Primero comprueba la conexión y carga la selección publicada.');
        const {repository,branch}=await destination();let response;
        try { response=await fetcher(`https://api.github.com/repos/${repository}/contents/${FILE}`,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify({message:'Actualizar cinco portadas de inicio de Box Play TV',branch,sha,content:encode(config)})}); }
        catch {throw failure(0);}
        if(!response.ok)throw failure(response.status);
        const data=await response.json();if(!data.commit?.sha||!data.content?.sha)throw failure(0);return data;
    }
    const api={FILE,SOURCE,automatic,title,image,key,validate,make,revision,resolve,probe,panoramic,read,catalog,repository,publish,encode,decode};
    root.BoxHomeCovers=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
