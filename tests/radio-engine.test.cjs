const { test } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../radio-engine.js');
function fixture() {
    const states = [], audios = [], timers = new Map(); let serial = 0;
    class Audio {
        constructor() { this.paused = true; this.playCalls = 0; audios.push(this); }
        play() { this.paused = false; this.playCalls++; return this.promise || Promise.resolve(); }
        pause() { this.paused = true; }
        load() {}
        removeAttribute(name) { delete this[name]; }
    }
    const analyser = { connect() {}, disconnect() {}, getByteFrequencyData(buffer) { buffer.fill(80); } };
    class AudioContext {
        constructor() { this.state = 'running'; }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        createAnalyser() { return analyser; }
        createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    }
    const env = { Audio, AudioContext, setTimeout(fn) { timers.set(++serial,fn);return serial; }, clearTimeout(id) { timers.delete(id); } };
    const engine = new Engine(state => states.push(state), env);
    return { engine, env, states, audios, timers };
}
const station = { url: 'https://radio.example/live.mp3' };
test('real analyser data is used only while the audio is playing', () => {
    const {engine, states, audios} = fixture();
    engine.prepare(); engine.start(station); audios[0].onplaying();
    const buffer = new Uint8Array(128);
    assert(engine.frequencies(buffer));assert.equal(buffer[0],80);
    assert.deepEqual(states.at(-1),{status:'playing',analysis:true});
    engine.pause();assert(!engine.frequencies(buffer));assert(buffer.every(x=>x===0));
});
test('CORS failure falls back to a fresh direct audio element without a fake spectrum', () => {
    const {engine,audios,states} = fixture();
    engine.prepare();engine.start(station);audios[0].onerror();
    assert.equal(audios.length,2);assert.equal(audios[0].src,undefined);
    assert.equal(audios[1].crossOrigin,undefined);audios[1].onplaying();
    assert.deepEqual(states.at(-1),{status:'playing',analysis:false});
    audios[1].onerror();assert.equal(states.at(-1).status,'error');assert.equal(engine.audio,null);
});
test('leaving Radio releases media, timers, analyser and pending playback callbacks', async () => {
    const {engine,audios,timers,states} = fixture();
    let reject;engine.prepare();engine.start(station);
    const playing=audios[0].onplaying;const failing=audios[0].onerror;
    audios[0].promise=new Promise((_,r)=>{reject=r;});engine.play(audios[0],engine.generation);
    engine.stop();reject(new Error('late failure'));await Promise.resolve();
    playing();failing();assert.equal(states.at(-1).status,'idle');
    assert(audios[0].paused);assert.equal(audios[0].src,undefined);assert.equal(timers.size,0);
    assert.equal(engine.analyser,null);assert.equal(engine.context.state,'suspended');
});
test('blocked autoplay offers another user action and retry can restart the same station', async () => {
    const {engine,audios,states} = fixture();engine.prepare();engine.start(station);
    audios[0].promise=Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));
    engine.play(audios[0],engine.generation);await Promise.resolve();assert.equal(states.at(-1).status,'blocked');
    audios[0].promise=Promise.resolve();engine.start(station);audios[0].onplaying();assert.equal(states.at(-1).status,'playing');
    engine.pause();engine.start(station);assert.equal(audios.length,2);
});
test('volume is bounded and connection timeout retries once without analysis then reports failure', () => {
    const {engine,audios,timers,states} = fixture();engine.prepare();engine.start(station,3);
    assert.equal(audios[0].volume,1);[...timers.values()][0]();
    assert.equal(audios.length,2);[...timers.values()][0]();assert.equal(states.at(-1).status,'error');
    engine.setVolume(-1);assert.equal(engine.volume,0);
});
test('pending HLS manifest never resumes after leaving or pausing Radio', () => {
    const {engine,env,audios,states} = fixture();let hls;
    class Hls { static isSupported(){return true;}static Events={MANIFEST_PARSED:'ready',ERROR:'error'};constructor(){hls=this;this.events={};}on(n,fn){this.events[n]=fn;}loadSource(){}attachMedia(){}destroy(){this.destroyed=true;} }
    env.Hls=Hls;engine.prepare();engine.start({url:'https://radio.example/live.m3u8'});
    engine.pause();hls.events.ready();assert.equal(audios[0].playCalls,0);assert(hls.destroyed);assert.equal(states.at(-1).status,'paused');
    engine.dispose();assert.equal(engine.context,null);
});
test('a repeated start must wait for the HLS manifest before calling play', () => {
    const {engine,env,audios} = fixture();let hls;
    class Hls { static isSupported(){return true;}static Events={MANIFEST_PARSED:'ready',ERROR:'error'};constructor(){hls=this;this.events={};}on(n,fn){this.events[n]=fn;}loadSource(){}attachMedia(){}destroy(){} }
    env.Hls=Hls;engine.prepare();const stream={url:'https://radio.example/third-favorite.m3u8'};
    engine.start(stream);engine.start(stream);
    assert.equal(audios[0].playCalls,0);
    hls.events.ready();assert.equal(audios[0].playCalls,1);
});
test('fatal HLS errors detach callbacks before destroying a player that emits more errors', () => {
    const {engine,env,states} = fixture();let hls, destroys=0;
    class Hls { static isSupported(){return true;}static Events={MANIFEST_PARSED:'ready',ERROR:'error'};constructor(){hls=this;this.events={};}on(n,fn){this.events[n]=fn;}loadSource(){}attachMedia(){}destroy(){if(++destroys>3)throw new Error('recursive teardown');this.events.error(null,{fatal:true});} }
    env.Hls=Hls;engine.prepare();engine.start({url:'https://radio.example/favorite.m3u8'});
    assert.doesNotThrow(()=>hls.events.error(null,{fatal:true}));
    assert.equal(destroys,1);assert.equal(states.at(-1).status,'error');assert.equal(engine.audio,null);
});
