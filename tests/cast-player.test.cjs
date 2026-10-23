const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Babel=require('@babel/standalone');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const full=html.match(/<script\b[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
const compiled=Babel.transform(full.slice(full.indexOf('function BoxCastControls'),full.indexOf('const LockScreen')),{presets:['react']}).code;
function render(url,state={}){
 const api=require('../cast.js');
 const sandbox={React,navigator:{userAgent:'Android'},URL,convertUrl:x=>x,window:{BoxCast:{...api,getState:()=>({ready:true,status:'ready',...state})}}};
 vm.runInNewContext(compiled+';globalThis.Player=BoxProPlayer;',sandbox);
 return renderToStaticMarkup(React.createElement(sandbox.Player,{item:{title:'Película de prueba',url},onBack:()=>{},onFullscreen:()=>{},containerRef:null}));
}

test('El reproductor muestra el icono y las opciones Cast para videos directos',()=>{
 const result=render('https://example.com/video.mp4');assert(result.includes('aria-label="Transmitir al televisor"'));assert(result.includes('Elegir televisor'));assert(result.includes('<video'));assert(result.includes('Fire TV Stick'));
});

test('Drive y OK.ru mantienen sus iframes y ofrecen duplicación en vez de un envío falso',()=>{
 for(const url of ['https://drive.google.com/file/d/id/preview','https://ok.ru/videoembed/123']){
  const result=render(url);assert(result.includes('<iframe'));assert(result.includes('duplicación'));assert(!result.includes('Elegir televisor'));
 }
});

test('La conexión verde y los controles pertenecen al video que realmente se envió',()=>{
 const current=render('https://example.com/video.mp4',{casting:true,contentId:'https://example.com/video.mp4',device:'Sala',duration:600,currentTime:22,canSeek:true});
 assert(current.includes('data-connected="true"'));assert(current.includes('Pausar en TV'));assert(current.includes('Volumen del televisor'));assert(current.includes('Detener envío'));
 const other=render('https://example.com/other.mp4',{casting:true,contentId:'https://example.com/video.mp4',device:'Sala'});
 assert(other.includes('data-connected="false"'));assert(!other.includes('Pausar en TV'));
});

test('El módulo configura su callback antes de cargar el SDK y todo el JSX compila',()=>{
 assert(html.indexOf('./cast.js?')<html.indexOf('cast_sender.js?'));Babel.transform(full,{presets:['react']});
});
