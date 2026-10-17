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

    const rates = 8000, seconds = 30, samples = rates * seconds;
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rates,24);wav.writeUInt32LE(rates*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
    for(let i=0;i<samples;i++){const t=i/rates;wav.writeInt16LE(Math.round(Math.sin(t*Math.PI*2*440)*(.3+.25*Math.sin(t*Math.PI*2*2))*30000),44+i*2);}
    files.set('radios.json',JSON.stringify([
        {title:'Radio Prueba Digital',group:'Costa Rica',genre:'Electrónica',url:'https://radio.test/real.wav'},
        {title:'Radio Sin Análisis',group:'Global',genre:'Jazz',url:`http://localhost:${server.address().port}/no-cors.wav`},
        {title:'Radio Fuera de Servicio',group:'Global',genre:'Pop',url:'https://radio.test/error.wav'}
    ]));
    files.set('no-cors.wav', wav);
    let mediaRequests=0;
    await context.route('https://radio.test/**',route=>{
        mediaRequests++;
        if(route.request().url().endsWith('/error.wav')) return route.abort();
        return route.fulfill({status:200,contentType:'audio/wav',headers:route.request().url().endsWith('/no-cors.wav')?{}:{'Access-Control-Allow-Origin':'*'},body:wav});
    });
    try {
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
        await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/');
        await page.getByRole('button',{name:'Comenzar Experiencia'}).click();
        await page.getByRole('button',{name:'Actualizar catálogo',exact:true}).waitFor();
        assert.equal(mediaRequests,0);
        await page.evaluate(()=>{const Base=window.BoxRadioEngine;window.BoxRadioEngine=class extends Base{constructor(...args){super(...args);window.testRadioEngine=this;}};});
        await page.locator('header nav').getByRole('button',{name:'Radio HD',exact:true}).click();
        await page.getByRole('heading',{name:'Radio Digital',exact:true}).waitFor();
        assert.equal(mediaRequests,0);
        const status=page.locator('.radio-status');
        await page.getByRole('button',{name:'Escuchar Radio Prueba Digital',exact:true}).click();
        await status.filter({hasText:'En directo'}).waitFor();
        await page.waitForFunction(()=>{const b=new Uint8Array(128);return window.testRadioEngine.frequencies(b)&&b.some(x=>x>0);});
        assert(await page.evaluate(()=>window.testRadioEngine.analyser instanceof AnalyserNode));
        await page.waitForFunction(()=>document.querySelector('.radio-spectrum').width>0);
        await page.getByRole('button',{name:'Silenciar radio',exact:true}).click();assert.equal(await page.evaluate(()=>window.testRadioEngine.audio.volume),0);
        await page.getByRole('button',{name:'Activar sonido de radio',exact:true}).click();assert(await page.evaluate(()=>window.testRadioEngine.audio.volume>0));
        await page.getByRole('button',{name:'Pausar radio',exact:true}).click();await status.filter({hasText:'En pausa'}).waitFor();assert.equal(await page.evaluate(()=>window.testRadioEngine.audio),null);
        await page.getByRole('button',{name:'Reproducir radio',exact:true}).click();await status.filter({hasText:'En directo'}).waitFor();
        await page.getByRole('button',{name:'Guardar emisora',exact:true}).click();
        await page.getByRole('button',{name:/^Favoritas/}).click();assert.equal(await page.locator('.radio-station').count(),1);
        await page.getByRole('button',{name:/^Todas/}).click();
        await page.getByRole('searchbox',{name:'Buscar emisora'}).fill('Jazz');assert.equal(await page.locator('.radio-station').count(),1);
        await page.getByRole('searchbox',{name:'Buscar emisora'}).fill('');
        await page.getByRole('combobox',{name:'Filtrar emisoras por grupo'}).selectOption('Costa Rica');assert.equal(await page.locator('.radio-station').count(),1);
        await page.getByRole('combobox',{name:'Filtrar emisoras por grupo'}).selectOption('all');
        console.log('PASS: real audio playback and FFT samples, pause/resume, volume, favorites, search and groups');
        await page.getByRole('button',{name:'Escuchar Radio Sin Análisis',exact:true}).click();await page.waitForFunction(()=>window.testRadioEngine.url.endsWith('/no-cors.wav')&&window.testRadioEngine.status==='playing'&&!window.testRadioEngine.analyser).catch(async error=>{console.error(await page.evaluate(()=>({url:window.testRadioEngine.url,status:window.testRadioEngine.status,analysis:!!window.testRadioEngine.analyser,cors:window.testRadioEngine.audio?.crossOrigin})));throw error;});
        assert.equal(await page.evaluate(()=>window.testRadioEngine.analyser),null);
        await page.getByText('Esta señal se reproduce sin visualizador de audio disponible.',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Escuchar Radio Fuera de Servicio',exact:true}).click();await status.filter({hasText:'No se pudo conectar'}).waitFor();
        await page.getByRole('button',{name:'Reintentar conexión',exact:true}).click();await status.filter({hasText:'No se pudo conectar'}).waitFor();
        console.log('PASS: CORS fallback preserves listening without fake bars; failed station and retry report actual status');
        await page.getByRole('button',{name:'Escuchar Radio Prueba Digital',exact:true}).click();await status.filter({hasText:'En directo'}).waitFor();
        for(const width of [320,390,430]){
            await page.setViewportSize({width,height:800});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            const canvas=await page.locator('.radio-spectrum').boundingBox();assert(canvas.x>=0&&canvas.x+canvas.width<=width);
        }
        await page.screenshot({path:'/tmp/box-radio-mobile.png',fullPage:true});
        const nav=page.getByRole('navigation',{name:'Navegación principal móvil'});
        await nav.getByRole('button',{name:'Películas',exact:true}).click();
        assert(await page.evaluate(()=>window.testRadioEngine.audio===null&&window.testRadioEngine.analyser===null&&window.testRadioEngine.status==='idle'));
        const requestsAfterExit=mediaRequests;
        await nav.getByRole('button',{name:'Series',exact:true}).click();await nav.getByRole('button',{name:'Inicio',exact:true}).click();
        assert.equal(mediaRequests,requestsAfterExit);
        await nav.getByRole('button',{name:'Más',exact:true}).click();await page.getByRole('button',{name:'Radio HD',exact:true}).click();
        await status.filter({hasText:'En pausa'}).waitFor();assert.equal(await page.evaluate(()=>window.testRadioEngine.audio),null);
        await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/box-radio-desktop.png',fullPage:true});
        assert.deepEqual(errors,[]);assert.deepEqual(requestsWithWrites,[]);
        console.log('PASS: radio fits 320/390/430px, leaving releases media immediately, other sections remain silent, returning requires Play');
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
