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
        res.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.json') ? 'application/json' : filename.endsWith('.webmanifest') ? 'application/manifest+json' : filename.endsWith('.png') ? 'image/png' : 'text/plain');
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
        const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
        await page.clock.install();
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/');
        await page.getByRole('button',{name:'Comenzar Experiencia'}).click();
        const hero=page.getByRole('region',{name:'Película recomendada'});
        const tabs=hero.getByRole('tab');await tabs.nth(4).waitFor();assert.equal(await tabs.count(),5);
        const titles=await tabs.allTextContents().then(labels=>labels.map(value=>value.trim()));assert.equal(new Set(titles).size,5);
        await tabs.nth(3).click();const selectedTitle=(await tabs.nth(3).locator('strong').textContent()).trim();
        assert.equal(await hero.getByRole('heading',{level:1}).innerText(),selectedTitle.toUpperCase());
        assert.equal(await tabs.nth(3).getAttribute('aria-selected'),'true');
        await tabs.nth(3).press('ArrowRight');assert.equal(await tabs.nth(4).getAttribute('aria-selected'),'true');
        await tabs.nth(4).press('Home');assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
        await tabs.nth(0).press('End');assert.equal(await tabs.nth(4).getAttribute('aria-selected'),'true');
        const lastTitle=(await tabs.nth(4).locator('strong').textContent()).trim();
        await hero.getByRole('button',{name:'Añadir a favoritos',exact:true}).click();
        assert(await page.evaluate(title=>JSON.parse(localStorage.getItem('boxplay_favs')).some(entry=>entry.title===title),lastTitle));
        await hero.getByRole('button',{name:'Ver ahora',exact:true}).click();
        await page.locator('.box-detail-title').waitFor();assert.equal((await page.locator('.box-detail-title').innerText()).toLocaleUpperCase(),lastTitle.toLocaleUpperCase());
        await page.getByRole('navigation',{name:'Secciones principales'}).getByRole('button',{name:'Inicio',exact:true}).click();
        await page.getByRole('region',{name:'Tendencias',exact:true}).getByRole('button',{name:'Explorar todo',exact:true}).click();
        await page.getByRole('heading',{name:'Tendencias',exact:true}).waitFor();
        assert(await page.locator('.card-glow').count()>16);
        await page.getByRole('navigation',{name:'Secciones principales'}).getByRole('button',{name:'Inicio',exact:true}).click();
        for(const width of [320,390,430,1024,1440,1920]){
            await page.setViewportSize({width,height:1000});
            await page.waitForFunction(()=>{const el=document.querySelector('.home-featured');return el?.getBoundingClientRect().width===innerWidth&&!document.querySelector('button[title="Actualizar catálogo"]').disabled;});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            const metrics=await hero.evaluate(el=>{const title=el.querySelector('h1'),image=el.querySelector('.home-feature-backdrop');return{width:el.getBoundingClientRect().width, titleFits:title.scrollWidth<=title.clientWidth+1, fit:getComputedStyle(image).objectFit};});
            assert.equal(metrics.width,width);assert(metrics.titleFits);assert.equal(metrics.fit,'contain');
            const fitted=await hero.locator('.home-feature-backdrop').evaluate(async image=>{
                const original=image.src, checks=[];
                for(const [w,h] of [[900,1350],[1920,1080],[2400,800]]){
                    image.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#164e63"/><circle cx="${w/2}" cy="${h*.1}" r="${Math.min(w,h)*.07}" fill="#67e8f9"/></svg>`);
                    await image.decode();
                    const rect=image.getBoundingClientRect(), hero=image.closest('.home-featured'), style=getComputedStyle(image);
                    const factor=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
                    const renderedWidth=image.naturalWidth*factor, renderedHeight=image.naturalHeight*factor;
                    const heroRect=hero.getBoundingClientRect();
                    checks.push(style.objectFit==='contain'&&renderedWidth<=rect.width+.1&&renderedHeight<=rect.height+.1&&rect.left>=heroRect.left&&rect.right<=heroRect.right&&rect.top>=heroRect.top&&rect.bottom<=heroRect.bottom);
                    if(innerWidth<640)checks.push(rect.bottom<=hero.querySelector('h1').getBoundingClientRect().top);
                    else checks.push(rect.bottom<=hero.querySelector('.home-feature-selectors').getBoundingClientRect().top);
                }
                image.src=original;await image.decode();return checks.every(Boolean);
            });
            assert(fitted,`Portrait and landscape artwork must fit completely at ${width}px`);

            if(width>=1024){
                const bounds=await tabs.evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().toJSON()));
                assert(bounds.every(rect=>rect.left>=0&&rect.right<=width));assert(bounds.every(rect=>Math.abs(rect.top-bounds[0].top)<1));
            }else{assert(await hero.locator('.home-feature-selectors').evaluate(el=>el.scrollWidth>el.clientWidth));}
        }
        await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/box-home-desktop.png',fullPage:true});
        await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/box-home-mobile.png',fullPage:true});
        console.log('PASS: five unique featured titles, keyboard selection, favorites, detail playback, explore buttons and 320–1920px layouts');

        await page.setViewportSize({width:1440,height:1000});

        // Hard reloads must change the leading cover and keep its metadata together.
        for(let reload=0;reload<4;reload++){
            const previous=await page.evaluate(()=>localStorage.getItem('boxplay_home_feature_last'));
            await page.reload();await page.getByRole('button',{name:'Comenzar Experiencia'}).click();
            await hero.getByRole('tab').nth(4).waitFor();
            const next=await page.evaluate(()=>localStorage.getItem('boxplay_home_feature_last'));
            assert.notEqual(next,previous);
            const title=await hero.locator('h1').textContent();
            assert(next.startsWith(title.trim().toLocaleLowerCase('es').replace(/\s+/g,' ')));
        }
        const originalSeries=JSON.parse(fs.readFileSync(path.join(root,'playlist.json'),'utf8'));
        const edge={...originalSeries[0],id:'full-pool-last-test',tituloSerie:'Título al final del catálogo completo',descripcion:'Sinopsis del título seleccionado al final de Trends.',backdrop:originalSeries[0].imagen||originalSeries[0].backdrop};
        files.set('playlist.json',JSON.stringify([...originalSeries,edge]));
        const chooseLast=async()=>page.evaluate(()=>{let first=true;Math.random=()=>{if(first){first=false;return 0;}return .999999999;};});
        await chooseLast();await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await hero.getByRole('heading',{level:1}).filter({hasText:edge.tituloSerie}).waitFor();
        assert.equal(await hero.locator('.home-feature-description').innerText(),edge.descripcion);
        const updated={...edge,tituloSerie:'Título actualizado al restaurar la página'};
        files.set('playlist.json',JSON.stringify([...originalSeries,updated]));
        await chooseLast();await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
        await hero.getByRole('heading',{level:1}).filter({hasText:updated.tituloSerie}).waitFor();
        const retained=await hero.locator('h1').innerText();
        failCatalog=true;
        await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await page.getByRole('status').filter({hasText:'Se conservó el catálogo anterior'}).waitFor();
        assert.equal(await hero.locator('h1').innerText(),retained);
        failCatalog=false;
        console.log('PASS: consecutive page reloads choose different covers; end-of-catalog entries are eligible with matching metadata; focus/restoration refresh and failure retention work');
        // Verify actual carousel timing with the browser clock; focus and reduced motion pause it.
        await page.setViewportSize({width:1440,height:1000});
        await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
        const before=await hero.locator('[aria-selected="true"]').getAttribute('id');
        await page.clock.fastForward(10000);assert.equal(await hero.locator('[aria-selected="true"]').getAttribute('id'),before);
        await page.emulateMedia({reducedMotion:'no-preference'});
        await hero.locator('[role=tabpanel][aria-live=off]').waitFor();
        await page.clock.fastForward(10000);
        await hero.locator('[aria-selected="true"]:not(#'+before+')').waitFor();
        assert.notEqual(await hero.locator('[aria-selected="true"]').getAttribute('id'),before);
        await hero.getByRole('button',{name:'Pausar cambio automático de destacados'}).click();
        const paused=await hero.locator('[aria-selected="true"]').getAttribute('id');
        await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);await page.clock.fastForward(20000);
        assert.equal(await hero.locator('[aria-selected="true"]').getAttribute('id'),paused);
        console.log('PASS: featured carousel advances automatically and respects pause/reduced motion');
        assert.deepEqual(errors,[]);assert.deepEqual(requestsWithWrites,[]);
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
