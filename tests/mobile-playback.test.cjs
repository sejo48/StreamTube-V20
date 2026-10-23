const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('react'), Renderer = require('react-test-renderer');
const Babel = require('@babel/standalone');
const {act} = Renderer;
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const jsx = html.match(/<script\b[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
const code = Babel.transform(jsx.slice(jsx.indexOf('function BoxCastControls'), jsx.indexOf('const LockScreen')), {presets:['react']}).code;

function setup(url = 'https://example.com/movie.mp4', sendResult) {
    let state = {ready:true, casting:false, connected:false, status:'ready'}, pauses = 0, loads = 0, writes = 0;
    const listeners = new Set(), events = new Map();
    const video = {currentTime:14, paused:false, canPlayType:()=>'',
        pause(){pauses++;this.paused=true;}, load(){loads++;},
        addEventListener(name,fn){events.set(name,fn);}, removeEventListener(name){events.delete(name);}, removeAttribute(){}
    };
    Object.defineProperty(video, 'src', {set(){writes++;}});
    const api = {...require('../cast.js'), getState:()=>state,
        subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
        cancelPending(){}, stop(){}, send:()=>sendResult || Promise.resolve({sent:true})};
    const dialog = {open:false, showModal(){this.open=true;}, close(){this.open=false;}};
    const sandbox = {React, URL, navigator:{userAgent:'Android'}, convertUrl:x=>x, window:{BoxCast:api}};
    vm.runInNewContext(code+';globalThis.Player=BoxProPlayer;',sandbox);
    const props = {item:{title:'Película', url}, onBack(){}, onFullscreen(){}};
    let renderer;
    act(()=>{renderer=Renderer.create(React.createElement(sandbox.Player, props), {
        createNodeMock(element){return element.type==='video' ? video : element.type==='dialog' ? dialog : {};}
    });});
    return {renderer, video, api, props,
        counts:()=>({pauses, loads, writes}),
        emit(patch){act(()=>{state={...state,...patch};listeners.forEach(fn=>fn({...state}));});},
        update(item){act(()=>renderer.update(React.createElement(sandbox.Player,{...props,item})));},
        unmount(){act(()=>renderer.unmount());}
    };
}

test('La detección o reconexión de un TV no pausa la reproducción del móvil',()=>{
    const p=setup();
    for(let i=0;i<4;i++){
        p.emit({casting:true,contentId:p.props.item.url,device:'Sala',currentTime:i*5});
        p.emit({casting:false,contentId:''});
    }
    assert.equal(p.counts().pauses,0);
    assert.equal(p.video.paused,false);
    p.unmount();
});

test('Solo se pausa el móvil después de un envío explícito completado',async()=>{
    let finish;const p=setup(undefined,new Promise(resolve=>{finish=resolve;}));
    const send=p.renderer.root.findAllByType('button').find(button=>button.children.includes('Elegir televisor'));
    let request;act(()=>{request=send.props.onClick();});
    assert.equal(p.counts().pauses,0);
    await act(async()=>{finish({sent:true});await request;});
    assert.equal(p.counts().pauses,1);
    p.unmount();
});

test('Un envío antiguo no pausa la siguiente película',async()=>{
    let finish;const p=setup(undefined,new Promise(resolve=>{finish=resolve;}));
    const send=p.renderer.root.findAllByType('button').find(button=>button.children.includes('Elegir televisor'));
    let request;act(()=>{request=send.props.onClick();});
    p.update({title:'Otra película',url:'https://example.com/other.mp4'});
    const before=p.counts().pauses;
    p.video.paused=false;
    await act(async()=>{finish({sent:true});await request;});
    assert.equal(p.counts().pauses,before);
    assert.equal(p.video.paused,false);
    p.unmount();
});

test('Actualizar metadatos y estado Cast conserva el video, su fuente y la pausa del usuario',()=>{
    const p=setup(); const before=p.counts();
    const node=p.renderer.root.findByType('video');p.video.paused=true;
    for(let i=0;i<5;i++){
        p.update({...p.props.item,title:'Título actualizado '+i});
        p.emit({currentTime:i,device:'Sala'});
    }
    assert.equal(p.renderer.root.findByType('video'),node);
    assert.deepEqual(p.counts(),before);assert.equal(p.video.paused,true);
    p.unmount();
});

test('Drive y OK.ru no recargan su iframe al actualizar la página o el estado Cast',()=>{
    for(const url of ['https://drive.google.com/file/d/id/preview','https://ok.ru/videoembed/123']){
        const p=setup(url), node=p.renderer.root.findByType('iframe');
        for(let i=0;i<5;i++){p.update({...p.props.item,title:'Título '+i});p.emit({currentTime:i});}
        assert.equal(p.renderer.root.findByType('iframe'),node);
        assert.equal(node.props.src,url);assert.equal(p.counts().pauses,0);p.unmount();
    }
});

test('El diálogo cerrado no solicita el foco antes de tocar Transmitir',()=>{
    const p=setup();
    assert.equal(p.renderer.root.findAllByType('button').some(button=>button.props.autoFocus),false);
    p.unmount();
});

function fullscreenHandler(container, document = {}) {
    const start=jsx.indexOf('const toggleMovieFullscreen =');
    const source=jsx.slice(start,jsx.indexOf('const getDisplayContent',start));
    const sandbox={movieContainerRef:{current:container},document};
    vm.runInNewContext(source+';globalThis.toggle=toggleMovieFullscreen;',sandbox);
    return sandbox.toggle;
}

test('La pantalla completa de iPhone se abre desde el botón sin recargar el video',()=>{
    let entered=0;
    const toggle=fullscreenHandler({querySelector:()=>({webkitEnterFullscreen(){entered++;}})});
    assert.equal(entered,0);toggle();assert.equal(entered,1);
});

test('Un rechazo de pantalla completa usa la alternativa nativa disponible',async()=>{
    let entered=0;
    const toggle=fullscreenHandler({querySelector:()=>({webkitEnterFullscreen(){entered++;}}),requestFullscreen:()=>Promise.reject(Error('Unsupported'))});
    toggle();await Promise.resolve();assert.equal(entered,1);
});

test('Abrir una película no programa cambios tardíos a pantalla completa',()=>{
    const start=jsx.indexOf('const handlePlayNow ='),end=jsx.indexOf('const handleRateMovie',start);
    const source=jsx.slice(start,end);
    const sandbox={isSubscriberActive:true,search:'',window:{history:{pushState(){}},scrollTo(){}},
        setSelectedItem(){},setIsPlaying(){},setExpandedSeason(){},setIsLocked(){},setSelectedEpisode(){},recordContinueWatching(){},
        setTimeout(){throw Error('No debe programar un cambio de pantalla');}};
    vm.runInNewContext(source+';handlePlayNow({type:"movies",url:"https://example.com/movie.mp4"});',sandbox);
});
