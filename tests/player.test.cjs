const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const React=require('react'),Renderer=require('react-test-renderer');
const {renderToStaticMarkup}=require('react-dom/server'),Babel=require('@babel/standalone');
const {act}=Renderer;
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const jsx=html.match(/<script\b[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
const convert=jsx.slice(jsx.indexOf('const convertUrl ='),jsx.indexOf('const getDriveDownloadUrl'));
const component=jsx.slice(jsx.indexOf('function BoxProPlayer'),jsx.indexOf('const LockScreen'));
const compiled=Babel.transform(convert+component,{presets:['react']}).code;
const movie={type:'movies2',title:'Road Wars',urlDrive:'https://drive.google.com/file/d/1GXxzOC8qRsoqX_hMPIvBPJVGjTrPN59z/view?usp=sharing'};
function player(userAgent='Android',extraWindow={}){
    const sandbox={React,URL,navigator:{userAgent},window:extraWindow};
    vm.runInNewContext(compiled+';globalThis.Player=BoxProPlayer;',sandbox);
    return sandbox.Player;
}

test('La página no carga el SDK, módulo, estilos ni controles de Google Cast',()=>{
    assert(!/cast_sender|cast\.js|cast\.css|BoxCast|box-cast-|__onGCastApiAvailable|cast\.framework/.test(html));
});

test('Todo el JSX compila y conserva los accesos de suscripción y PIN',()=>{
    Babel.transform(jsx,{presets:['react']});
    assert(jsx.includes("!isSubscriberActive"));
    assert(jsx.includes('isLocked ? ('));
    assert(jsx.indexOf('<LockScreen correctCode=')<jsx.indexOf('<BoxProPlayer item='));
});

test('Road Wars usa el reproductor original de Drive en móvil y televisor',()=>{
    for(const ua of ['Mozilla/5.0 (Linux; Android 14; SM-S918B) Mobile','Mozilla/5.0 (Linux; Android TV 12; BRAVIA)']){
        const rendered=renderToStaticMarkup(React.createElement(player(ua),{item:movie}));
        assert(rendered.includes('https://drive.google.com/file/d/1GXxzOC8qRsoqX_hMPIvBPJVGjTrPN59z/preview'));
        assert.equal((rendered.match(/<iframe/g)||[]).length,1);
        assert(!rendered.includes('<video'));assert(!rendered.includes('<dialog'));
        assert(!rendered.includes('Transmitir'));assert(!rendered.includes('Reproducir en Google Drive'));
    }
});

test('MP4, HLS y OK.ru conservan su reproductor correspondiente',()=>{
    for(const url of ['https://example.com/movie.mp4','https://example.com/master.m3u8']){
        const rendered=renderToStaticMarkup(React.createElement(player(),{item:{title:'Prueba',url}}));
        assert(rendered.includes('<video'));assert(!rendered.includes('<iframe'));
    }
    const rendered=renderToStaticMarkup(React.createElement(player(),{item:{title:'Prueba',urlOkRu:'https://ok.ru/video/123'}}));
    assert(rendered.includes('https://ok.ru/videoembed/123'));
});

test('Las actualizaciones de la página no reemplazan el iframe de Road Wars',()=>{
    const Player=player();let renderer;
    act(()=>{renderer=Renderer.create(React.createElement(Player,{item:movie}));});
    const frame=renderer.root.findByType('iframe');
    for(let i=0;i<10;i++)act(()=>renderer.update(React.createElement(Player,{item:{...movie,title:'Road Wars '+i}})));
    assert.equal(renderer.root.findByType('iframe'),frame);
    assert.equal(frame.props.src,'https://drive.google.com/file/d/1GXxzOC8qRsoqX_hMPIvBPJVGjTrPN59z/preview');
    act(()=>renderer.unmount());
});

test('El video directo no recibe pausas ni recargas mientras sigue seleccionado',()=>{
    let pauses=0,loads=0,writes=0;const events=new Map();
    const video={pause(){pauses++;},load(){loads++;},removeAttribute(){},addEventListener(n,f){events.set(n,f);},removeEventListener(n){events.delete(n);}};
    Object.defineProperty(video,'src',{set(){writes++;}});
    const Player=player();const item={title:'Prueba',url:'https://example.com/movie.mp4'};let renderer;
    act(()=>{renderer=Renderer.create(React.createElement(Player,{item}),{createNodeMock:e=>e.type==='video'?video:{}});});
    for(let i=0;i<10;i++)act(()=>renderer.update(React.createElement(Player,{item:{...item,title:'Prueba '+i}})));
    assert.deepEqual({pauses,loads,writes},{pauses:0,loads:0,writes:1});
    act(()=>renderer.unmount());assert.equal(pauses,1);assert.equal(loads,1);assert.equal(events.size,0);
});
