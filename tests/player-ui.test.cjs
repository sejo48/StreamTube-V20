const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const React=require('react'),Renderer=require('react-test-renderer'),{act}=Renderer;
function setup(node={contains:()=>false}){
 const events=new Map(),timers=new Map();let id=0,ui,renderer;
 const document={activeElement:null,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const sandbox={React,window:{},document,setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../player-ui.js'),'utf8'),sandbox);
 const ref={current:node};function Harness(){ui=sandbox.window.BoxPlayerUI.usePlayerUI(ref,'movie');return null;}
 act(()=>{renderer=Renderer.create(React.createElement(Harness));});
 return {get ui(){return ui;},document,events,timers,node,close(){act(()=>renderer.unmount());},tick(){act(()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(f=>f());});}};
}
test('menu hides after inactivity over iframe, wakes, and toggles manually',()=>{
 const s=setup({contains:()=>true});s.document.activeElement={tagName:'IFRAME'};
 s.tick();assert.equal(s.ui.visible,false);act(()=>s.ui.events.onPointerMove({target:{}}));assert.equal(s.ui.visible,true);
 act(()=>s.ui.toggleMenu());assert.equal(s.ui.visible,false);act(()=>s.ui.toggleMenu());assert.equal(s.ui.visible,true);s.close();assert.equal(s.events.size,0);assert.equal(s.timers.size,0);
});
test('keyboard focus on controls keeps menu available',()=>{const s=setup({contains:()=>true});s.document.activeElement={tagName:'BUTTON'};s.tick();assert.equal(s.ui.visible,true);s.close();});
test('unsupported fullscreen uses viewport and Escape restores view',()=>{const s=setup();act(()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,true);act(()=>s.events.get('keydown')({key:'Escape'}));assert.equal(s.ui.full,false);s.close();});
test('rejected fullscreen uses fallback and can exit',async()=>{const s=setup({contains:()=>false,requestFullscreen:()=>Promise.reject(new Error('denied'))});await act(async()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,true);act(()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,false);s.close();});
test('native fullscreen follows browser changes and exits using its API',()=>{let exits=0;const node={contains:()=>false,requestFullscreen(){s.document.fullscreenElement=node;s.events.get('fullscreenchange')();return Promise.resolve();}};const s=setup(node);s.document.exitFullscreen=()=>{exits++;s.document.fullscreenElement=null;s.events.get('fullscreenchange')();return Promise.resolve();};act(()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,true);act(()=>s.ui.toggleFullscreen());assert.equal(exits,1);assert.equal(s.ui.full,false);s.close();});
test('Safari prefixed fullscreen enters and exits',()=>{let exits=0;const node={contains:()=>false,webkitRequestFullscreen(){s.document.webkitFullscreenElement=node;s.events.get('webkitfullscreenchange')();}};const s=setup(node);s.document.webkitExitFullscreen=()=>{exits++;s.document.webkitFullscreenElement=null;s.events.get('webkitfullscreenchange')();};act(()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,true);act(()=>s.ui.toggleFullscreen());assert.equal(s.ui.full,false);assert.equal(exits,1);s.close();});
test('moving onto the recovery button does not reopen before its click',()=>{const s=setup();s.tick();const event={target:{closest:()=>true}};act(()=>{s.ui.events.onPointerMove(event);s.ui.events.onFocus(event);});assert.equal(s.ui.visible,false);act(()=>s.ui.toggleMenu());assert.equal(s.ui.visible,true);s.close();});
