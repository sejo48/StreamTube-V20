/* Offline integration checks: local React/Babel/HLS/Tailwind assets, no Firebase or media services. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const C = require('../catalog.js');
const root = path.resolve(__dirname, '..');
const moduleFile = (name, file) => path.join(path.dirname(require.resolve(name + '/package.json')), file);
const styles = fs.readFileSync(process.env.BOXPLAY_TEST_CSS, 'utf8');
const files = new Map();
let failCatalog = false, requestsWithWrites = [];
const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { requestsWithWrites.push(req.method + ' ' + req.url); res.writeHead(405); return res.end(); }
    const filename = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)) || 'index.html';
    if (filename.includes('..') || (filename.includes('/') && !/^icons\/[\w.-]+$/.test(filename))) { res.writeHead(404); return res.end(); }
    if (failCatalog && filename === 'peliculas.json') { res.writeHead(503); return res.end('Unavailable'); }
    try {
        let body = files.get(filename) || fs.readFileSync(path.join(root, filename));
        if (filename.endsWith('.html')) body = body.toString().replace(/<script type="module">[\s\S]*?<\/script>/g, '<!-- Firebase excluded from offline integration tests -->');
        res.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.json') ? 'application/json' : filename.endsWith('.webmanifest') ? 'application/manifest+json' : filename.endsWith('.png') ? 'image/png' : 'text/plain');
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext({ acceptDownloads: true });
    const errors = [];
    await context.route('https://**/*', async route => {
        const request = route.request(), url = request.url();
        if (!['GET', 'HEAD'].includes(request.method())) requestsWithWrites.push(request.method() + ' ' + url);
        let resource;
        if (url.includes('unpkg.com/react-dom@')) resource = moduleFile('react-dom', 'umd/react-dom.development.js');
        else if (url.includes('unpkg.com/react@')) resource = moduleFile('react', 'umd/react.development.js');
        else if (url.includes('unpkg.com/@babel/standalone')) resource = moduleFile('@babel/standalone', 'babel.min.js');
        else if (url.includes('cdn.jsdelivr.net/npm/hls.js')) resource = moduleFile('hls.js', 'dist/hls.js');
        if (resource) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(resource) });
        if (url.includes('cdn.tailwindcss.com')) return route.fulfill({ contentType: 'application/javascript', body: `window.tailwind={};const style=document.createElement('style');style.textContent=${JSON.stringify(styles)};document.head.appendChild(style);` });
        if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64') });
        return route.abort();
    });
    try {
        const N=require('../notices.js');
        let repositoryFeed={schemaVersion:1,notices:[]},sha='version-0',writes=0,dropResponse=false;
        await context.route('https://api.github.com/**',async route=>{
            const request=route.request(),url=new URL(request.url());
            assert.equal(url.pathname,'/repos/sejo48/StreamTube-V20/contents/avisos.json');
            if(request.headers()['authorization']!=='Bearer example-test-credential')return route.fulfill({status:403,json:{message:'Forbidden'}});
            if(request.method()==='GET')return route.fulfill({json:{sha,encoding:'base64',content:N.encode(repositoryFeed)}});
            assert.equal(request.method(),'PUT');
            const body=request.postDataJSON();
            if(body.sha!==sha)return route.fulfill({status:409,json:{message:'Conflict'}});
            repositoryFeed=N.validate(N.decode(body.content));sha='version-'+(++writes);
            files.set('avisos.json',JSON.stringify(repositoryFeed));
            if(dropResponse){dropResponse=false;return route.abort();}
            return route.fulfill({json:{commit:{sha:'commit-'+writes},content:{sha}}});
        });
        const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.goto(origin+'/admin.html');
        await admin.getByText('Datos descargados y actualizados correctamente',{exact:true}).waitFor();
        await admin.getByRole('button',{name:/^Avisos/}).click();
        await admin.getByLabel('Credencial de GitHub para publicar avisos').fill('example-test-credential');
        await admin.getByRole('textbox',{name:'Título del aviso',exact:true}).fill('Estrenos de la semana');
        await admin.getByRole('textbox',{name:'Mensaje del aviso',exact:true}).fill('Películas nuevas <em>para todos</em> 🎬');
        await admin.getByRole('combobox',{name:'Sección del aviso',exact:true}).selectOption('movies2');
        await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
        await admin.getByText('Aviso publicado. Aparecerá en la principal cuando se actualice el sitio.',{exact:true}).waitFor();
        assert.equal(repositoryFeed.notices.length,1);assert.equal(writes,1);
        assert.equal(await admin.evaluate(()=>Object.values(localStorage).some(value=>value.includes('example-test-credential'))),false);
        const primary=await context.newPage();primary.on('pageerror',e=>errors.push(e.message));
        await primary.setViewportSize({width:390,height:800});
        await primary.addInitScript(()=>{window.badgeCalls=[];Object.defineProperty(navigator,'setAppBadge',{configurable:true,value:async count=>window.badgeCalls.push(count)});Object.defineProperty(navigator,'clearAppBadge',{configurable:true,value:async()=>window.badgeCalls.push('clear')});});
        await primary.goto(origin+'/');
        const bell=primary.getByRole('button',{name:'Avisos, 1 sin leer',exact:true});await bell.waitFor();
        assert(await primary.evaluate(()=>window.badgeCalls.includes(1)));
        const bellBox=await bell.boundingBox();assert(bellBox.x>=0 && bellBox.x+bellBox.width<=390);
        await bell.click();const panel=primary.getByRole('dialog',{name:'Avisos de Box Play TV'});await panel.waitFor();
        assert(await panel.getByText('Películas nuevas <em>para todos</em> 🎬',{exact:true}).isVisible());assert.equal(await panel.locator('em').count(),0);
        await panel.getByRole('button',{name:'Marcar todos como leídos',exact:true}).click();
        assert.equal(await primary.evaluate(()=>window.badgeCalls.at(-1)),'clear');
        await panel.getByRole('button',{name:'Cerrar avisos',exact:true}).click();
        await primary.reload();await primary.getByRole('button',{name:'Avisos',exact:true}).waitFor();
        assert.equal(await primary.getByRole('button',{name:'Avisos, 1 sin leer',exact:true}).count(),0);
        console.log('PASS: publicación desde administrador, aviso en principal, contador de campana/icono, texto escapado y lectura persistente');
        await admin.getByRole('textbox',{name:'Título del aviso',exact:true}).fill('Aviso de prueba con respuesta perdida');
        await admin.getByRole('textbox',{name:'Mensaje del aviso',exact:true}).fill('Un reintento no debe duplicar este aviso.');
        dropResponse=true;
        await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
        await admin.getByRole('alert').filter({hasText:'No se confirmó'}).waitFor();
        assert.equal(repositoryFeed.notices.length,2);assert.equal(writes,2);
        await admin.getByRole('button',{name:'Publicar aviso',exact:true}).click();
        await admin.waitForFunction(()=>document.querySelector('input[aria-label="Título del aviso"]').value==='');
        assert.equal(repositoryFeed.notices.length,2);assert.equal(writes,2);
        await primary.getByRole('button',{name:'Avisos',exact:true}).click();
        await primary.getByText('Aviso de prueba con respuesta perdida',{exact:true}).waitFor();
        assert(await primary.evaluate(()=>window.badgeCalls.at(-1)===1));
        await admin.locator('article').filter({hasText:'Aviso de prueba con respuesta perdida'}).getByRole('button',{name:'Retirar aviso',exact:true}).click();
        await admin.getByRole('button',{name:'Confirmar',exact:true}).click();
        await admin.getByText('Aviso retirado. El cambio aparecerá al actualizarse el sitio.',{exact:true}).waitFor();
        await panel.getByRole('button',{name:'Actualizar avisos',exact:true}).click();
        await panel.getByText('Estás al día',{exact:true}).waitFor();assert.equal(await primary.evaluate(()=>window.badgeCalls.at(-1)),'clear');
        assert.equal(writes,3);assert.equal(repositoryFeed.notices.length,1);
        console.log('PASS: publicación idempotente después de respuesta perdida, retiro de aviso y limpieza del contador');
        await panel.getByRole('button',{name:'Cerrar avisos',exact:true}).click();
        await primary.setViewportSize({width:1280,height:900});
        const desktopBell=await primary.getByRole('button',{name:'Avisos',exact:true}).boundingBox();
        assert(desktopBell.x>=0 && desktopBell.x+desktopBell.width<=1280);
        assert.deepEqual(errors,[]);assert.deepEqual(requestsWithWrites,[]);
        console.log('PASS: no credenciales persistentes ni excepciones; toda publicación fue simulada y solo apunta a avisos.json');
        } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
