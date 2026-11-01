/* Smart TV integration with isolated catalogs/auth; no remote writes or media. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
let fail=false;
const series=[{tituloSerie:'Serie Águila',imagen:'https://example.com/poster.jpg',descripcion:'Sinopsis extensa de la serie. '.repeat(40),codigo:'1234',temporadas:[{numeroTemporada:1,episodios:[{tituloEpisodio:'Piloto',urlDrive:'https://drive.google.com/file/d/test-episode/view'},{tituloEpisodio:'Sin enlace',urlDrive:''}]},{numeroTemporada:3,episodios:[{tituloEpisodio:'Regreso',urlDrive:'https://ok.ru/video/123456'}]},{numeroTemporada:4,episodios:[]}]},{tituloSerie:'Sin temporadas',temporadas:[]}];
const island=JSON.parse(fs.readFileSync(path.join(root,'playlist.json'),'utf8')).find(item=>item.tituloSerie==='La isla de Gilligan');
series.push(island);
const movie={titulo:'Película de prueba',urlDrive:'https://drive.google.com/file/d/test-movie/view'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1);
 if(req.method!=='GET'||name.includes('..')){res.writeHead(405);return res.end();}
 if(name==='playlist.json'){if(fail){res.writeHead(503);return res.end();}res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(series));}
 if(['peliculas.json','peliculas2.json'].includes(name)){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify([movie]));}
 if(name==='smart-tv-auth.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.testAllowed=false;window.boxTVAuth={valid:async()=>window.testAllowed,verify:async()=>({activo:window.testAllowed})};');}
 try{res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(root,name)));}catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:Number(process.env.TV_TEST_HEIGHT)||720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.fulfill({contentType:'text/html',body:'<p>Reproductor simulado</p>'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/smart-tv.html');
  await page.locator('#grid button').waitFor();
  // Native shell API / remote OK opens Series and its first item.
  await page.locator('#series').focus();await page.evaluate(()=>window.boxTV.ok());
  await page.getByRole('button',{name:'Serie Águila',exact:true}).waitFor();
  assert.equal(await page.locator('#section-title').textContent(),'Series');
  await page.getByRole('button',{name:'Serie Águila',exact:true}).focus();await page.keyboard.press('Enter');
  const visibleEpisodes=await page.locator('#episodes button').first().evaluate(button=>{const r=button.getBoundingClientRect(),d=document.getElementById('details').getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom&&r.bottom<=innerHeight;});
  assert(visibleEpisodes,'Episodes must be visible on opening, even with a long synopsis');
  assert(await page.locator('#episode-next').evaluate(button=>{const b=button.getBoundingClientRect(),d=document.getElementById('details').getBoundingClientRect();return b.top>=d.top&&b.bottom<=d.bottom;}),'Page controls fit inside the TV dialog');
  assert.equal(await page.locator('#watch').isVisible(),false);
  assert.equal(await page.locator('#seasons button').count(),3);
  await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Temporada 3');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#episodes button').first().textContent(),'1. Regreso');
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');
  assert(await page.getByRole('button',{name:'2. Sin enlace · Próximamente'}).isDisabled());
  await page.getByRole('button',{name:'1. Piloto',exact:true}).click();
  await page.locator('#login[open]').waitFor();assert.equal(await page.locator('#player').isVisible(),false,'Subscription still required');
  await page.evaluate(()=>{window.testAllowed=true;window.boxTV.back();});
  await page.getByRole('button',{name:'1. Piloto',exact:true}).click();
  await page.locator('#pin[open]').waitFor();
  await page.locator('#pin-value').fill('wrong');await page.locator('#pin-form button.primary').click();
  assert.equal(await page.locator('#pin-message').textContent(),'Clave incorrecta.');
  await page.locator('#pin-value').fill('1234');await page.locator('#pin-form button.primary').click();
  await page.locator('#screen iframe').waitFor();
  assert.match(await page.locator('#screen iframe').getAttribute('src'),/test-episode\/preview/);
  assert.equal(await page.locator('#playing-title').textContent(),'Serie Águila · Piloto');
  await page.evaluate(()=>window.boxTV.back());
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'1. Piloto');
  await page.getByRole('button',{name:'Temporada 3',exact:true}).click();
  await page.getByRole('button',{name:'1. Regreso',exact:true}).click();
  await page.locator('#pin-value').fill('1234');await page.locator('#pin-form button.primary').click();
  await page.locator('#screen iframe').waitFor();assert.match(await page.locator('#screen iframe').getAttribute('src'),/ok.ru\/videoembed\/123456/);
  await page.evaluate(()=>window.boxTV.back());
  await page.getByRole('button',{name:'Temporada 4',exact:true}).click();
  assert.match(await page.locator('#episodes-message').textContent(),/no tiene episodios/);
  await page.evaluate(()=>window.boxTV.back());
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Serie Águila');
  await page.getByRole('button',{name:'Sin temporadas',exact:true}).click();
  assert.match(await page.locator('#episodes-message').textContent(),/no tiene temporadas/);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'detail-close');
  await page.keyboard.press('Escape');
  await page.locator('#search').fill('aguila');await page.locator('#search').press('Enter');
  assert.equal(await page.locator('#grid button').count(),1,'Accent insensitive series search');
  await page.evaluate(()=>window.boxTV.back());
  assert.equal(await page.locator('#grid button').count(),3);
  await page.locator('#movies').click();await page.locator('#grid button').first().click();
  assert(await page.locator('#watch').isVisible());assert.equal(await page.locator('#series-browser').isVisible(),false);
  await page.locator('#watch').click();await page.locator('#screen iframe').waitFor();
  assert.match(await page.locator('#screen iframe').getAttribute('src'),/test-movie\/preview/);
  await page.evaluate(()=>{window.boxTV.back();window.boxTV.back();});
  await page.locator('#series').click();await page.getByRole('button',{name:'La isla de Gilligan',exact:true}).click();
  for(const season of island.temporadas){
   await page.getByRole('button',{name:'Temporada '+season.numeroTemporada,exact:true}).click();
   assert.equal(await page.locator('#episodes button').count(),Math.min(2,season.episodios.length));
   assert.match(await page.locator('#episode-count').textContent(),new RegExp('de '+season.episodios.length+'$'));
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.parentElement.id),'episodes');
   for(let i=1;i<season.episodios.length;i++){await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>Number(document.activeElement.dataset.episodeIndex)),i,'Remote reaches every episode across pages');}
   const visible=await page.locator('#episodes button').last().evaluate(button=>{const b=button.getBoundingClientRect(),p=button.parentElement.getBoundingClientRect();return document.activeElement===button&&b.top>=p.top&&b.bottom<=p.bottom;});
   assert(visible,'Last episode of La isla is reachable and visible with the remote');
  }
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:10009,bubbles:true,cancelable:true})));
  assert.equal(await page.locator('#details').getAttribute('open'),null,'TV Back key closes the series');
  // A failed series load can be retried from the same section.
  fail=true;await page.reload();await page.locator('#grid button').waitFor();await page.locator('#series').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('No se pudo cargar'));
  fail=false;await page.locator('#series').click();await page.getByRole('button',{name:'Serie Águila',exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'TV header fits viewport');
  assert.deepEqual(errors,[]);
  console.log('Passed: Series, seasons, episodes, search, remote OK/back/focus, subscription and PIN, movie regression and load retry.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
