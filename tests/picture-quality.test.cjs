const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function element(tag){return {tag,children:[],style:{setProperty(...args){this.value=args}},setAttribute(){},append(...nodes){this.children.push(...nodes)},remove(){this.removed=true}}}
const video=element('video'),root=element('root');root.querySelector=s=>s==='video'?video:null;
const context={window:{Hls:{Events:{MANIFEST_PARSED:'parsed'}}},document:{readyState:'loading',addEventListener(){},querySelectorAll(){return [root]},createElement:element},localStorage:{getItem(){return 'fit'},setItem(){}},WeakMap};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../picture-quality.js'),'utf8'),context);
const api=context.window.BoxPicture;api.scan();let bar=root.children[0],size=bar.children[0],quality=bar.children[1];assert.equal(video.style.value[1],'contain');size.onclick();assert.equal(video.style.value[1],'scale-down');assert.equal(quality.hidden,true);
let parsed;const engine={levels:[],on(event,fn){parsed=fn}};api.bind(video,engine);engine.levels=[{height:1080,bitrate:200},{height:360,bitrate:50},{height:720,bitrate:100}];parsed();assert.equal(quality.hidden,false);quality.onclick();assert.equal(engine.currentLevel,0);quality.onclick();assert.equal(engine.currentLevel,-1);assert.equal(root.children.length,1);assert.equal(api.best([{height:720,bitrate:100},{height:720,bitrate:200}]),1);
root.querySelector=s=>s==='iframe'?element('iframe'):null;api.scan();assert.equal(bar.removed,true);assert.equal(root.children.length,1);api.scan();assert.equal(root.children.length,1);
console.log('Passed: sizing, storage fallback, late HLS manifest, unsorted levels, auto restore, no remount, no overlay on provider frames');
