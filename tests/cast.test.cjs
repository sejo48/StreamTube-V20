const test=require('node:test'),assert=require('node:assert/strict');
const {mediaFor,createController}=require('../cast.js');

function setup({cancel=false,fail=false,delayChoose=false,delayLoad=false}={}){
 const log=[],listeners={},remote={isPaused:false,isMediaLoaded:false,currentTime:0,duration:0,volumeLevel:1,canSeek:true};
 let active=null,notify=()=>{},chooseResolve,loadResolve;
 const context={setOptions:opts=>log.push(['options',opts]),addEventListener:(type,fn)=>listeners[type]=fn,getCurrentSession:()=>active,requestSession:()=>{
  log.push(['chooser']);listeners.session({sessionState:'starting'});
  if(cancel)return Promise.reject({code:'cancel'});
  const promise=delayChoose?new Promise(resolve=>chooseResolve=resolve):Promise.resolve();
  return promise.then(()=>{active=session;listeners.session({sessionState:'started'});});
 }};
 const session={getCastDevice:()=>({friendlyName:'TV de prueba'}),getMediaSession:()=>remote.mediaInfo?{media:remote.mediaInfo}:null,loadMedia:async request=>{
  log.push(['load',request]);if(fail)throw {code:'load_media_failed'};
  if(delayLoad)await new Promise(resolve=>loadResolve=resolve);
  remote.mediaInfo=request.media;remote.isMediaLoaded=true;remote.duration=600;remote.currentTime=request.currentTime;notify();
 },endSession:flag=>{log.push(['end',flag]);active=null;remote.isMediaLoaded=false;listeners.session({sessionState:'ended'});}};
 class RemotePlayerController{constructor(){notify=()=>listeners.remote?.();}addEventListener(type,fn){listeners.remote=fn;}playOrPause(){remote.isPaused=!remote.isPaused;notify();}seek(){log.push(['seek',remote.currentTime]);notify();}setVolumeLevel(){log.push(['volume',remote.volumeLevel]);notify();}}
 const env={location:{protocol:'https:',hostname:'boxplaytv.com'},setTimeout:()=>1,clearTimeout:()=>{},cast:{framework:{CastContext:{getInstance:()=>context},CastContextEventType:{CAST_STATE_CHANGED:'cast',SESSION_STATE_CHANGED:'session'},SessionState:{SESSION_ENDED:'ended',SESSION_START_FAILED:'failed'},RemotePlayer:class{constructor(){return remote;}},RemotePlayerController,RemotePlayerEventType:{ANY_CHANGE:'change'}}},chrome:{cast:{AutoJoinPolicy:{TAB_AND_ORIGIN_SCOPED:'tab'},Image:class{constructor(url){this.url=url;}},media:{DEFAULT_MEDIA_RECEIVER_APP_ID:'default',StreamType:{LIVE:'LIVE',BUFFERED:'BUFFERED'},MediaInfo:class{constructor(url,mime){this.contentId=url;this.contentType=mime;}},MovieMediaMetadata:class{},LoadRequest:class{constructor(media){this.media=media;}}}}}};
 const api=createController(env);api.initialize();return {api,env,log,remote,resolveChoose:()=>chooseResolve(),resolveLoad:()=>loadResolve(),listeners};
}

test('Reconoce formatos directos y bloquea páginas de Drive, OK.ru y URL inseguras',()=>{
 for(const [extension,mime]of [['mp4','video/mp4'],['webm','video/webm'],['m3u8','application/x-mpegURL']]){const media=mediaFor('https://cdn.example/video.'+extension+'?token=abc');assert.equal(media.supported,true);assert.equal(media.mime,mime);}
 assert.equal(mediaFor('https://drive.google.com/file/d/id/preview',{contentType:'video/mp4'}).reason,'drive');
 assert.equal(mediaFor('https://ok.ru/videoembed/123',{contentType:'video/mp4'}).reason,'ok');
 for(const url of ['javascript:alert(1)','blob:test','https://user:password@example.com/video.mp4','https://example.com/page.html','https://example.com/watch/123'])assert.equal(mediaFor(url).supported,false);
});

test('Envía el episodio con metadata mínima y retoma su posición después de elegir el TV',async()=>{
 const {api,log}=setup();const item={title:'La serie',image:'https://example.com/poster.jpg',email:'privado',codigo:'1234',token:'secreto'};
 const media=mediaFor('https://example.com/episodio.mp4',item,{title:'Episodio 2'});
 const result=await api.send(media,42);assert.equal(result.sent,true);
 const request=log.find(x=>x[0]==='load')[1];assert.equal(request.currentTime,42);assert.equal(request.media.metadata.title,'Episodio 2');assert.equal(request.media.metadata.subtitle,'La serie');
 assert(!JSON.stringify(request).includes('privado'));assert(!JSON.stringify(request).includes('secreto'));assert(!JSON.stringify(request).includes('1234'));
 assert.equal(api.getState().device,'TV de prueba');assert.equal(api.getState().casting,true);assert.equal(api.getState().loading,false);
 assert.equal(log.filter(x=>x[0]==='chooser').length,1);
});

test('Cancelar el selector no carga videos ni muestra un error falso',async()=>{
 const {api,log}=setup({cancel:true});const result=await api.send(mediaFor('https://example.com/video.mp4'));
 assert.equal(result.cancelled,true);assert(!log.some(x=>x[0]==='load'));assert.equal(api.getState().error,'');assert.equal(api.getState().loading,false);
});

test('El rechazo del TV no se presenta como reproducción exitosa',async()=>{
 const {api}=setup({fail:true});await assert.rejects(api.send(mediaFor('https://example.com/video.mp4')),/no pudo abrir/);
 assert.equal(api.getState().casting,false);assert.equal(api.getState().loading,false);assert(api.getState().error);
});

test('Pausa, avance, volumen y desconexión controlan la sesión del televisor',async()=>{
 const {api,remote,log}=setup();await api.send(mediaFor('https://example.com/video.mp4'));
 api.playPause();assert.equal(api.getState().paused,true);api.seek(900);assert.equal(remote.currentTime,600);api.setVolume(2);assert.equal(remote.volumeLevel,1);
 api.stop();assert.equal(api.getState().connected,false);assert.equal(api.getState().casting,false);assert(log.some(x=>x[0]==='end'&&x[1]===true));
});

test('Salir mientras está abierto el selector impide que el video empiece después',async()=>{
 const {api,log,resolveChoose}=setup({delayChoose:true});const media=mediaFor('https://example.com/video.mp4');
 const pending=api.send(media);api.cancelPending(media.url);resolveChoose();const result=await pending;
 assert.equal(result.cancelled,true);assert(!log.some(x=>x[0]==='load'));assert.equal(api.getState().casting,false);assert.equal(api.getState().loading,false);
});

test('Salir mientras carga el video detiene la sesión e ignora respuestas antiguas',async()=>{
 const {api,log,resolveLoad}=setup({delayLoad:true});const media=mediaFor('https://example.com/video.mp4');
 const pending=api.send(media);await new Promise(resolve=>setImmediate(resolve));api.cancelPending(media.url);resolveLoad();const result=await pending;
 assert.equal(result.cancelled,true);assert.equal(api.getState().casting,false);assert.equal(api.getState().loading,false);assert(log.some(x=>x[0]==='end'));
});

test('Drive y OK.ru no abren el selector del receptor multimedia',async()=>{
 const {api,log}=setup();await assert.rejects(api.send(mediaFor('https://drive.google.com/file/d/id/preview')));
 assert(!log.some(x=>x[0]==='chooser'));assert(!log.some(x=>x[0]==='load'));
});

test('Sin SDK o sin HTTPS muestra un estado de ayuda y no finge una conexión',()=>{
 let timeout;const env={location:{protocol:'https:',hostname:'example.com'},setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>{}};
 const api=createController(env);api.initialize();timeout();assert.equal(api.getState().status,'unavailable');assert.equal(api.getState().connected,false);
 const http=createController({...env,location:{protocol:'http:',hostname:'example.com'}});http.initialize();assert.match(http.getState().error,/HTTPS/);
});
