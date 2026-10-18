/* Offline integration checks: local React/Babel/HLS/Tailwind assets, no Firebase or media services. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const C = require('../catalog.js');
const H = require('../home-features.js');
const root = path.resolve(__dirname, '..');
const moduleFile = (name, file) => path.join(path.dirname(require.resolve(name + '/package.json')), file);
const styles = fs.readFileSync(process.env.BOXPLAY_TEST_CSS, 'utf8');
const files = new Map();
// This suite exercises automatic covers; curated covers have a separate integration suite.
files.set('portadas-inicio.json',JSON.stringify({schemaVersion:1,source:'peliculas2.json',mode:'automatic',items:[]}));
const originalReleases=JSON.parse(fs.readFileSync(path.join(root,'peliculas2.json'),'utf8'));
const invalidReleases=[
 {...originalReleases[0],titulo:'No mostrar: fondo vertical',fechaEstreno:'2026-10-18',backdrop:'https://images.test/hero-portrait.jpg'},
 {...originalReleases[0],titulo:'No mostrar: fondo roto',fechaEstreno:'2026-10-17',backdrop:'https://images.test/hero-broken.jpg'},
 {...originalReleases[0],titulo:'No mostrar: solo póster',fechaEstreno:'2026-10-17',backdrop:'',banner:''}
];
files.set('peliculas2.json',JSON.stringify([...invalidReleases,...originalReleases]));
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
        if (request.resourceType() === 'image') {
            if(url.includes('hero-broken'))return route.fulfill({status:404,body:''});
            const [width,height]=url.includes('hero-portrait')?[900,1350]:[1920,1080];
            return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#164e63"/></svg>`});
        }
        return route.abort();
    });

    try {
        const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
        await page.clock.install();
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/');
        await page.getByRole('button',{name:'Comenzar Experiencia'}).waitFor();await page.clock.fastForward(2100);
        const hero=page.getByRole('region',{name:'Película recomendada'});
        const shortcuts=page.getByRole('navigation',{name:'Accesos directos del inicio'});
        await hero.locator('h1').waitFor();
        const expected=H.candidates({movies2:originalReleases}).slice(0,5);
        const selectedTitle=(await hero.locator('h1').textContent()).trim();
        const selectedMovie=expected.find(item=>item.titulo===selectedTitle);assert(selectedMovie);
        assert.equal(await hero.getByRole('tab').count(),0);
        assert(await hero.locator('.home-feature-backdrop').evaluate(image=>image.naturalWidth/image.naturalHeight>=1.5));
        assert.equal(await hero.locator('.home-feature-backdrop').getAttribute('src'),selectedMovie.backdrop);
        assert.equal(await hero.locator('.home-feature-description').textContent(),selectedMovie.descripcion||selectedMovie.sinopsis||selectedMovie.plot);
        const play=hero.getByRole('button',{name:'Ver ahora',exact:true});
        assert.equal(await play.evaluate(button=>getComputedStyle(button).backgroundColor),'rgb(255, 255, 255)');
        await hero.getByRole('button',{name:'Mi lista',exact:true}).click();
        assert(await page.evaluate(title=>JSON.parse(localStorage.getItem('boxplay_favs')).some(entry=>entry.title===title),selectedTitle));
        assert.equal(await hero.getByRole('button',{name:'Quitar de favoritos',exact:true}).getAttribute('aria-pressed'),'true');
        await hero.getByRole('button',{name:'Quitar de favoritos',exact:true}).click();
        assert.equal(await hero.getByRole('button',{name:'Mi lista',exact:true}).getAttribute('aria-pressed'),'false');
        await hero.getByRole('button',{name:'Mi lista',exact:true}).click();
        page.once('dialog',dialog=>dialog.accept('4'));
        await hero.getByRole('button',{name:'Calificar',exact:true}).click();
        await hero.getByRole('button',{name:'Tu voto: 4/5',exact:true}).waitFor();
        const savedRatings=await page.evaluate(()=>localStorage.getItem('boxplay_personal_ratings'));
        assert(Object.values(JSON.parse(savedRatings)).includes(4));
        // The home watch action must use the normal subscription gate.
        await play.click();await page.getByRole('heading',{name:'Contenido Premium',exact:true}).waitFor();
        assert.equal(await page.locator('video,iframe').count(),0);
        await page.getByRole('button',{name:'✕',exact:true}).click();
        if((selectedMovie.urlDrive||selectedMovie.url||'').includes('drive.google.com')){
            await hero.getByRole('button',{name:'Descargar',exact:true}).click();
            await page.getByRole('heading',{name:'Descarga Segura',exact:true}).waitFor();
            assert(await page.getByPlaceholder('••••').isVisible());
            await page.getByRole('button',{name:'Cancelar',exact:true}).click();
        }
        await page.getByRole('region',{name:'Tendencias',exact:true}).getByRole('button',{name:'Explorar todo',exact:true}).click();
        await page.getByRole('heading',{name:'Tendencias',exact:true}).waitFor();assert(await page.locator('.card-glow').count()>16);
        await page.getByRole('navigation',{name:'Secciones principales'}).getByRole('button',{name:'Inicio',exact:true}).click();
        for(const width of [320,390,430,1024,1440,1920]){
            await page.setViewportSize({width,height:1000});
            const metrics=await (await page.waitForFunction(()=>{
                const el=document.querySelector('.home-featured'),title=el?.querySelector('h1'),image=el?.querySelector('.home-feature-backdrop');
                if(el?.getBoundingClientRect().width!==innerWidth||el.getAttribute('aria-busy')==='true'||!image?.complete||document.querySelector('button[title="Actualizar catálogo"]').disabled)return false;
                const copy=el.querySelector('.home-feature-copy').getBoundingClientRect(),rect=el.getBoundingClientRect();
                return {width:rect.width,height:rect.height,titleFits:title.scrollWidth<=title.clientWidth+1,fit:getComputedStyle(image).objectFit,copyLeft:copy.left,copyBottom:copy.bottom,heroBottom:rect.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
            })).jsonValue();
            assert.equal(metrics.width,width);assert(metrics.titleFits);assert.equal(metrics.fit,'cover');assert(!metrics.overflow);
            if(width>=1024){assert(metrics.height>=850);assert(metrics.copyLeft<=width*.04);assert(metrics.heroBottom-metrics.copyBottom<=41);}
            // Use an inert DOM copy to test alternate source ratios without mutating React's live image.
            const fitted=await hero.evaluate(async liveHero=>{
                const copy=liveHero.cloneNode(true);
                copy.style.cssText='position:fixed;left:0;top:0;width:100vw;z-index:10000;pointer-events:none';
                document.body.appendChild(copy);
                const image=copy.querySelector('.home-feature-backdrop'),checks=[],details=[];
                try {
                for(const [w,h] of [[1600,1000],[1920,1080],[2400,800]]){
                    image.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#164e63"/><circle cx="${w/2}" cy="${h*.1}" r="${Math.min(w,h)*.07}" fill="#67e8f9"/></svg>`);
                    await image.decode();
                    const rect=image.getBoundingClientRect(),hero=image.closest('.home-featured'),style=getComputedStyle(image),heroRect=hero.getBoundingClientRect();
                    const factor=Math.max(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
                    checks.push(style.objectFit==='cover'&&image.naturalWidth*factor>=rect.width-.1&&image.naturalHeight*factor>=rect.height-.1&&Math.abs(rect.left-heroRect.left)<1&&Math.abs(rect.right-heroRect.right)<1&&Math.abs(rect.top-heroRect.top)<1&&Math.abs(rect.bottom-heroRect.bottom)<1);
                    checks.push(style.objectPosition==='50% 0%');
                    for(const element of hero.querySelectorAll('h1,.home-watch,.home-feature-description,.home-feature-tools button')){
                        const bounds=element.getBoundingClientRect();checks.push(bounds.left>=rect.left&&bounds.right<=rect.right+.1&&bounds.top>=rect.top&&bounds.bottom<=rect.bottom+.1);
                    }
                    checks.push(getComputedStyle(hero.querySelector('.home-feature-shade')).backgroundImage.includes('linear-gradient'));
                    details.push({w,h,attached:image.isConnected,fit:style.objectFit,position:style.objectPosition,rect:rect.toJSON(),hero:heroRect.toJSON(),elements:Array.from(hero.querySelectorAll('h1,.home-watch,.home-feature-description,.home-feature-tools button'),el=>({class:el.className,rect:el.getBoundingClientRect().toJSON()}))});
                }
                return {pass:checks.every(Boolean),details};
                } finally { copy.remove(); }
            });
            assert(fitted.pass,`Full-screen premiere, text and controls must fit at ${width}px: ${JSON.stringify(fitted.details)}`);
            assert.deepEqual(await shortcuts.getByRole('button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label'))),['TV','Radio','Estrenos','Películas','Series']);
            const quickLayout=await shortcuts.evaluate(nav=>{
                const buttons=Array.from(nav.querySelectorAll('button')),hero=nav.previousElementSibling,firstShelf=document.querySelector('.home-shelves');
                const rect=nav.getBoundingClientRect(),panorama=hero.getBoundingClientRect();
                return hero.classList.contains('home-featured')&&Math.abs(rect.top-panorama.bottom)<1&&rect.bottom<=firstShelf.getBoundingClientRect().top+1&&buttons.every(button=>{
                    const box=button.getBoundingClientRect(),label=button.querySelector('strong');
                    return box.width>=44&&box.height>=44&&box.left>=0&&box.right<=innerWidth+.1&&Math.abs(box.top-buttons[0].getBoundingClientRect().top)<1&&label.scrollWidth<=label.clientWidth+1;
                });
            });
            assert(quickLayout,`Five readable shortcut cards must sit below the panorama in one row at ${width}px`);
        }
        await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'/tmp/box-home-desktop.png',fullPage:true});
        await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'/tmp/box-home-mobile.png',fullPage:true});
        console.log('PASS: reference-style full-screen premiere, white watch button, favorite synchronization, personal rating, protected download, subscription gate and 320–1920px layouts');
        for(const width of [390,1440]){
            await page.setViewportSize({width,height:1000});
            for(const [label,id] of [['TV','tv'],['Radio','radio'],['Estrenos','movies2'],['Películas','movies'],['Series','series']]){
                const button=shortcuts.getByRole('button',{name:label,exact:true});
                if(width===1440){await button.focus();await button.press('Enter');}else await button.click();
                await page.waitForFunction(expected=>history.state?.activeTab===expected,id);
                assert.equal(await shortcuts.count(),0);assert.equal(await hero.count(),0);
                if(id==='radio'){
                    await page.getByRole('heading',{name:'Radio Digital',exact:true}).waitFor();
                    assert(await page.locator('audio').evaluateAll(elements=>elements.every(audio=>audio.paused)));
                }
                const menu=page.getByRole('navigation',{name:width===390?'Navegación principal móvil':'Secciones principales'});
                await menu.getByRole('button',{name:'Inicio',exact:true}).click();
                await shortcuts.waitFor();
            }
        }
        console.log('PASS: five shortcut cards below the panorama remain readable at 320–1920px; touch and keyboard open TV, Radio, Estrenos, Películas and Series without starting radio playback');
        await page.setViewportSize({width:1440,height:1000});
        for(let reload=0;reload<4;reload++){
            const previous=await page.evaluate(()=>localStorage.getItem('boxplay_home_feature_last'));
            await page.reload();await page.getByRole('button',{name:'Comenzar Experiencia'}).waitFor();await page.clock.fastForward(2100);await hero.locator('h1').waitFor();
            const next=await page.evaluate(()=>localStorage.getItem('boxplay_home_feature_last'));
            assert.notEqual(next,previous);
            const title=(await hero.locator('h1').textContent()).trim();assert(expected.some(item=>item.titulo===title));
            assert(next.startsWith(title.toLocaleLowerCase('es').replace(/\s+/g,' ')));
            assert.equal(await page.evaluate(()=>localStorage.getItem('boxplay_personal_ratings')),savedRatings);
        }
        const edge={...originalReleases[0],id:'newest-estreno-test',titulo:'Último estreno disponible',fechaEstreno:'2026-10-17',descripcion:'Sinopsis del estreno más reciente.',backdrop:'https://images.test/newest-wide.jpg'};
        files.set('peliculas2.json',JSON.stringify([...invalidReleases,...originalReleases,edge]));
        const chooseNewest=async()=>page.evaluate(()=>{Math.random=()=>.999999999;});
        await chooseNewest();await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await hero.getByRole('heading',{level:1}).filter({hasText:edge.titulo}).waitFor();
        assert.equal(await hero.locator('.home-feature-description').innerText(),edge.descripcion);
        const updated={...edge,titulo:'Estreno actualizado al restaurar la página'};
        files.set('peliculas2.json',JSON.stringify([...invalidReleases,...originalReleases,updated]));
        await chooseNewest();await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
        await hero.getByRole('heading',{level:1}).filter({hasText:updated.titulo}).waitFor();
        const retained=await hero.locator('h1').innerText();
        failCatalog=true;
        await page.clock.fastForward(1500);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await page.getByRole('status').filter({hasText:'Se conservó el catálogo anterior'}).waitFor();
        assert.equal(await hero.locator('h1').innerText(),retained);failCatalog=false;
        console.log('PASS: every page opening chooses another recent Estreno; portrait/broken/missing backgrounds and other sections are excluded; restoration refresh and network failure retention work');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.clock.fastForward(60000);
        assert.equal(await hero.locator('h1').innerText(),retained);
        assert.equal(await hero.locator('.home-feature-selectors,.home-carousel-controls').count(),0);
        console.log('PASS: cover remains fixed while browsing instead of changing on a timer');
        assert.deepEqual(errors,[]);assert.deepEqual(requestsWithWrites,[]);
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
