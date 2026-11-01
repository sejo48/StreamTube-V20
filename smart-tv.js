(function(){
 'use strict';
 const $=id=>document.getElementById(id), fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let section='new',page=0,query='',items=[],current=null,returnFocus=null,hls=null,media=null,loadToken=0,tap=null,busy=false,authorized=false;
 const size=24, catalogs={},paths={new:'peliculas2.json',movies:'peliculas.json',series:'playlist.json'},labels={new:'Estrenos',movies:'Películas',series:'Series'};
 let detailItem=null,episodeFocus=null,seasonIndex=0,episodePage=0;
 const episodePageSize=12;
 function text(id,value){$(id).textContent=value||'';}
 function storage(key,value){try{if(arguments.length>1)localStorage.setItem(key,value);else return localStorage.getItem(key);}catch(_){}return '';}
 function normalize(x,isSeries=false){return {isSeries:isSeries||Array.isArray(x.temporadas),seasons:Array.isArray(x.temporadas)?x.temporadas:[],title:x.tituloSerie||x.titulo||x.title||x.nombre||'Sin título',description:x.descripcion||x.description||x.sinopsis||'',image:x.imagen||x.image||x.poster||'',year:x.year||x.anio||'',runtime:x.runtime||'',pin:x.codigo||x.password||x.pin||'',url:x.urlOkRu||x.urlDrive||x.url||x.link||''};}
 function poster(url){return String(url||'').replace(/image\.tmdb\.org\/t\/p\/(?:original|w\d+)\//,'image.tmdb.org/t/p/w185/');}
 function safeURL(value){if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,location.href);return /^https?:$/.test(u.protocol)?u:null;}catch(_){return null;}}
 function embedURL(value){const u=safeURL(value);if(!u)return '';if(u.hostname==='drive.google.com'){const id=(u.pathname.match(/\/d\/([^/]+)/)||[])[1]||u.searchParams.get('id');return id?'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/preview?autoplay=1':'';}if(/(^|\.)ok\.ru$/.test(u.hostname)){const id=(u.pathname.match(/(?:videoembed|video)\/(\d+)/)||[])[1];return id?'https://ok.ru/videoembed/'+id+'?autoplay=1&nochat=1':u.href;}return u.href;}
 async function catalog(next){section=next;page=0;text('section-title',labels[next]);Object.keys(paths).forEach(key=>$(key).setAttribute('aria-pressed',String(next===key)));$('search').placeholder=next==='series'?'Buscar serie':'Buscar película';$('search').setAttribute('aria-label',$('search').placeholder);const token=++loadToken;text('message','Cargando catálogo…');$('grid').replaceChildren();try{if(!catalogs[next]){const r=await fetch(paths[next],{cache:'no-cache'});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data))throw Error();catalogs[next]=data.map(x=>normalize(x,next==='series'));}if(token!==loadToken)return;items=catalogs[next];render();}catch(_){if(token===loadToken){text('message','No se pudo cargar el catálogo. Selecciona de nuevo la sección para reintentar.');text('count','');$('pages').hidden=true;}}}
 function render(){const found=items.filter(x=>!query||fold(x.title).includes(fold(query)));page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(found.length/size)-1)));$('grid').replaceChildren();found.slice(page*size,(page+1)*size).forEach(item=>{const b=document.createElement('button'),im=document.createElement('img'),name=document.createElement('span');im.loading='lazy';im.decoding='async';im.alt='';if(safeURL(item.image))im.src=poster(item.image);im.onerror=()=>{im.removeAttribute('src');im.onerror=null;};name.className='name';name.textContent=item.title;b.setAttribute('aria-label',item.title);b.append(im,name);b.onclick=()=>details(item,b);$('grid').append(b);});text('message',found.length?'':section==='series'?'No se encontraron series.':'No se encontraron películas.');text('count',found.length+' títulos');$('pages').hidden=!found.length;text('page-count',(page+1)+' / '+Math.max(1,Math.ceil(found.length/size)));$('prev').disabled=page===0;$('next').disabled=(page+1)*size>=found.length;}
 function focusDetail(){const target=detailItem?.isSeries?(episodeFocus?.isConnected&&!episodeFocus.disabled?episodeFocus:$('seasons').querySelector('button[aria-pressed="true"]')||$('detail-close')):$('watch');target.focus();}
 function seasonEpisodes(){const season=detailItem?.seasons[seasonIndex];return Array.isArray(season?.episodios)?season.episodios:[];}
 function renderEpisodes(){
  const episodes=seasonEpisodes(),start=episodePage*episodePageSize;
  $('episodes').replaceChildren();episodeFocus=null;
  text('episodes-message',episodes.length?'':'Esta temporada todavía no tiene episodios.');
  $('episode-pages').hidden=!episodes.length;
  text('episode-count',episodes.length?'Episodios '+(start+1)+'–'+Math.min(start+episodePageSize,episodes.length)+' de '+episodes.length:'');
  $('episode-prev').disabled=episodePage===0;$('episode-next').disabled=start+episodePageSize>=episodes.length;
  episodes.slice(start,start+episodePageSize).forEach((episode,index)=>{
   const i=start+index,button=document.createElement('button'),title=episode.tituloEpisodio||episode.titulo||'Episodio '+(i+1),url=episode.urlDrive||episode.urlOkRu||episode.url||'';
   const number=document.createElement('span'),name=document.createElement('span');number.className='episode-number';number.textContent=String(i+1).padStart(2,'0');name.className='episode-name';name.textContent=title+(safeURL(url)?'':' · Próximamente');button.title=title;button.setAttribute('aria-label',(i+1)+'. '+title+(safeURL(url)?'':' · Próximamente'));button.append(number,name);button.disabled=!safeURL(url);button.dataset.episodeIndex=i;
   button.onclick=()=>{episodeFocus=button;current={...detailItem,title:detailItem.title+' · '+title,url};watch();};$('episodes').append(button);
  });
 }
 function changeEpisodePage(delta,focusLast=false){
  const next=episodePage+delta;if(next<0||next*episodePageSize>=seasonEpisodes().length)return false;
  episodePage=next;renderEpisodes();const buttons=$('episodes').querySelectorAll('button:not(:disabled)');
  const target=buttons.length?buttons[focusLast?buttons.length-1:0]:!$('episode-next').disabled?$('episode-next'):$('episode-prev');target.focus();return true;
 }
 function showSeason(index){
  seasonIndex=index;episodePage=0;const season=detailItem.seasons[index];
  Array.from($('seasons').children).forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  text('episodes-title','Temporada '+(season.numeroTemporada??index+1)+' · Episodios');renderEpisodes();
 }
 $('episode-prev').onclick=()=>changeEpisodePage(-1);
 $('episode-next').onclick=()=>changeEpisodePage(1);

 function details(item,b){
  current=item;detailItem=item;episodeFocus=null;returnFocus=b;text('detail-title',item.title);text('detail-description',item.description);text('detail-meta',[item.year,item.runtime,item.isSeries?item.seasons.length+' temporadas':''].filter(Boolean).join(' · '));$('detail-image').src=poster(item.image);
  $('episode-pages').hidden=true;$('watch').hidden=item.isSeries;$('series-browser').hidden=!item.isSeries;$('seasons').replaceChildren();$('episodes').replaceChildren();
  if(item.isSeries){
   text('episodes-message',item.seasons.length?'':'Esta serie todavía no tiene temporadas disponibles.');text('episodes-title','Episodios');
   item.seasons.forEach((season,index)=>{const button=document.createElement('button');button.textContent='Temporada '+(season.numeroTemporada??index+1);button.onclick=()=>showSeason(index);$('seasons').append(button);});
   if(item.seasons.length)showSeason(0);
  }
  $('details').classList.toggle('is-series',item.isSeries);$('details').showModal();focusDetail();
 }
 function closeDetails(){$('details').close();if(returnFocus&&returnFocus.isConnected)returnFocus.focus();}
 function openLogin(){text('login-message','');$('email').value=storage('boxplay_user_email');$('login').showModal();$('email').focus();}
 async function verify(){if(!window.boxTVAuth)throw Error('La conexión de acceso aún está cargando. Intenta de nuevo.');const email=$('email').value.trim().toLowerCase();const result=await window.boxTVAuth.verify(email);if(!result.activo){authorized=false;const reasons={no_existe:'No encontramos una suscripción activa con ese correo.',vencida:'La suscripción está vencida o inactiva.',dispositivo_no_autorizado:'Este correo ya está vinculado a otro dispositivo. Contacta al administrador.'};throw Error(reasons[result.razon]||'No se pudo verificar el acceso. Revisa Internet.');}storage('boxplay_user_email',email);authorized=true;return true;}
 $('login-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('verify').disabled=true;text('login-message','Verificando…');try{await verify();text('login-message','Acceso activo. Ya puedes reproducir películas y series.');$('login').close();if(current&&$('details').open)focusDetail();}catch(error){text('login-message',error.message);}finally{busy=false;$('verify').disabled=false;}};
 async function watch(){if(!current||busy)return;busy=true;try{if(!window.boxTVAuth||!await window.boxTVAuth.valid()){authorized=false;openLogin();return;}if(current.pin){text('pin-message','');$('pin-value').value='';$('pin').showModal();$('pin-value').focus();return;}start();}catch(_){authorized=false;openLogin();text('login-message','Verifica tu acceso para continuar.');}finally{busy=false;}}
 $('pin-form').onsubmit=e=>{e.preventDefault();if(String($('pin-value').value)!==String(current.pin)){text('pin-message','Clave incorrecta.');return;}$('pin').close();start();};
 
 let controlsTimer=null,providerFocused=false,nativePlaying=false;
 const shellVersion=(navigator.userAgent.match(/BOXPLAYTV-AndroidTV\/(\d+)\.(\d+)/)||[]);
 const nativeProvider=Number(shellVersion[1])>2||(Number(shellVersion[1])===2&&Number(shellVersion[2])>=1);
 function playerOpen(){return !$('player').hidden;}
 function controlsHidden(){return $('player').classList.contains('controls-hidden');}
 function hideControls(){
  clearTimeout(controlsTimer);controlsTimer=null;if(!playerOpen())return;
  $('player').classList.add('controls-hidden');$('player-controls').setAttribute('aria-hidden','true');
  $('player-controls').querySelectorAll('button').forEach(button=>button.tabIndex=-1);
  if(media)media.controls=false;
  if($('player-controls').contains(document.activeElement)){$('player').tabIndex=-1;$('player').focus({preventScroll:true});}
 }
 function showControls(focus){
  if(!playerOpen())return;
  clearTimeout(controlsTimer);$('player').classList.remove('controls-hidden');
  $('player-controls').removeAttribute('aria-hidden');
  $('player-controls').querySelectorAll('button').forEach(button=>button.tabIndex=0);
  if(media)media.controls=true;
  if(focus)$('player-go').focus({preventScroll:true});
  controlsTimer=setTimeout(hideControls,3000);
 }
 function fillScreen(){
  const player=$('player');if(!playerOpen()||shellVersion.length)return;
  if(!document.fullscreenElement&&player.requestFullscreen){
   try{const result=player.requestFullscreen();if(result&&result.catch)result.catch(()=>{});}catch(_){}
  }
 }

 function cleanup(){providerFocused=false;clearTimeout(controlsTimer);controlsTimer=null;if(hls){hls.destroy();hls=null;}if(media){media.pause();media.removeAttribute('src');media.load();media=null;}$('screen').replaceChildren();tap=null;}
 function start(){document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());cleanup();const url=embedURL(current.url);if(!url){text('player-status','Este título no tiene un enlace válido.');$('player').hidden=false;document.body.classList.add('playing');showControls(false);$('player-exit').focus();return;}$('player').hidden=false;document.body.classList.add('playing');showControls(false);fillScreen();text('playing-title',current.title);text('player-status','Cargando…');if(nativeProvider&&/^https:\/\/(?:drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview|ok\.ru\/videoembed\/\d+)(?:[?#]|$)/.test(url)){hideControls();nativePlaying=true;location.href='boxplaytv://play?url='+encodeURIComponent(url);return;}if(/\.(m3u8|mp4|webm)(?:[?#]|$)/i.test(url)){const video=document.createElement('video');media=video;video.controls=true;video.playsInline=true;video.onplaying=()=>text('player-status','Reproduciendo');video.onwaiting=()=>text('player-status','Cargando señal…');video.onerror=()=>text('player-status','No se pudo reproducir. Pulsa Reintentar.');$('screen').append(video);if(/\.m3u8(?:[?#]|$)/i.test(url)&&!video.canPlayType('application/vnd.apple.mpegurl'))loadHls(video,url);else{video.src=url;video.play().catch(()=>text('player-status','Pulsa Play para comenzar.'));}}else{const frame=document.createElement('iframe');frame.src=url;frame.title=current.title;frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.onload=()=>{if(!playerOpen())return;text('player-status','Pulsa OK en Play. Si hace falta, pulsa OK otra vez.');showControls(true);};$('screen').append(frame);}$('player-go').focus();}
 async function loadHls(video,url){try{if(!window.Hls)await new Promise((resolve,reject)=>{let script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});if(media!==video)return;if(!Hls.isSupported())throw Error();hls=new Hls({maxBufferLength:20,maxMaxBufferLength:30,capLevelToPlayerSize:true});hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>text('player-status','Pulsa Play para comenzar.')));hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)text('player-status','No se pudo reproducir. Pulsa Reintentar.');});hls.loadSource(url);hls.attachMedia(video);}catch(_){if(media===video)text('player-status','No se pudo abrir esta señal. Pulsa Reintentar.');}}
 function playerOK(){if(media){if(media.paused)media.play().catch(()=>text('player-status','No se pudo iniciar. Reintenta.'));else media.pause();return;}const frame=$('screen').querySelector('iframe');if(frame){providerFocused=true;hideControls();const r=frame.getBoundingClientRect();tap=[r.left+r.width/2,r.top+r.height/2,innerWidth,innerHeight];frame.focus();}}
 function stop(){if(nativePlaying){nativePlaying=false;location.href='boxplaytv://stop';}if(document.fullscreenElement&&$('player').contains(document.fullscreenElement)&&document.exitFullscreen){try{const result=document.exitFullscreen();if(result&&result.catch)result.catch(()=>{});}catch(_){}}cleanup();$('player').hidden=true;document.body.classList.remove('playing');if(current&&!$('details').open)$('details').showModal();focusDetail();}
 function back(){if(!$('player').hidden){stop();return true;}if($('pin').open){$('pin').close();focusDetail();return true;}if($('login').open){$('login').close();if($('details').open)focusDetail();else $('account').focus();return true;}if($('details').open){closeDetails();return true;}if(query){query='';$('search').value='';page=0;render();$('search').focus();return true;}return false;}
 function focusables(){const scope=!$('player').hidden?$('player'):Array.from(document.querySelectorAll('dialog[open]')).pop()||document;return Array.from(scope.querySelectorAll('button,input')).filter(e=>!e.disabled&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0);}
 function move(direction){if(playerOpen()&&providerFocused)return false;if(playerOpen()){if(controlsHidden()){showControls(true);return true;}showControls(false);}const active=document.activeElement;if(active&&active.tagName==='INPUT')return false;
  if(active&&active.parentElement?.id==='seasons'&&direction==='ArrowDown'){const first=$('episodes').querySelector('button:not(:disabled)');if(first){first.focus();return true;}if(!$('episode-next').disabled){$('episode-next').focus();return true;}}
  if(active&&active.parentElement?.id==='episodes'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(direction)){
   const buttons=Array.from($('episodes').children),index=buttons.indexOf(active),delta=direction==='ArrowDown'?3:direction==='ArrowUp'?-3:direction==='ArrowRight'?1:-1;
   let next=index+delta;
   while(next>=0&&next<buttons.length&&buttons[next].disabled)next+=delta;
   if(next>=0&&next<buttons.length){buttons[next].focus();return true;}
   if(direction==='ArrowRight'||direction==='ArrowDown'){if(changeEpisodePage(1))return true;$('detail-close').focus();return true;}
   if(changeEpisodePage(-1,true))return true;$('seasons').querySelector('button[aria-pressed="true"]')?.focus();return true;
  }
  const all=focusables();if(!all.length)return true;if(!all.includes(active)){all[0].focus();return true;}const b=active.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;let best=null,score=Infinity;all.forEach(e=>{if(e===active)return;const r=e.getBoundingClientRect(),dx=r.left+r.width/2-x,dy=r.top+r.height/2-y;const horizontal=direction==='ArrowLeft'||direction==='ArrowRight',forward=direction==='ArrowLeft'?-dx:direction==='ArrowRight'?dx:direction==='ArrowUp'?-dy:dy;if(forward<=2)return;const cross=horizontal?Math.abs(dy):Math.abs(dx),s=forward+cross*4;if(s<score){score=s;best=e;}});if(best){best.focus();best.scrollIntoView({block:'nearest'});}return true;}
 function ok(){tap=null;if(playerOpen()&&providerFocused)return 'native';if(playerOpen()){if(controlsHidden()){showControls(true);return null;}showControls(false);}const active=document.activeElement;if(active&&active.tagName==='INPUT')return null;if(active&&active.tagName==='BUTTON'&&!active.disabled)active.click();else if(!$('player').hidden)playerOK();return tap;}
 $('player').addEventListener('pointermove',()=>showControls(false));
 $('player').addEventListener('pointerdown',()=>showControls(false));
 $('player').addEventListener('focusin',()=>{if(!controlsHidden())showControls(false);});
 window.boxTV={move,ok,back,embedURL,normalize};
 document.addEventListener('keydown',e=>{if(e.defaultPrevented)return;const code=e.keyCode||e.which,key=({37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',23:'Enter',27:'Escape',4:'Escape',461:'Escape',10009:'Escape',166:'Escape'})[code]||e.key;if(key==='ContextMenu'&&playerOpen()){e.preventDefault();providerFocused=false;showControls(true);}else if(key==='Escape'){e.preventDefault();back();}else if(key?.startsWith('Arrow')){if(move(key))e.preventDefault();}else if(key==='Enter'&&document.activeElement.tagName!=='INPUT'){const result=ok();if(result!=='native')e.preventDefault();}});
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{e.preventDefault();back();}));
 Object.keys(paths).forEach(key=>$(key).onclick=()=>catalog(key));$('search-form').onsubmit=e=>{e.preventDefault();query=$('search').value.trim();page=0;render();$('grid').querySelector('button')?.focus();};$('prev').onclick=()=>{page--;render();$('grid').querySelector('button')?.focus();};$('next').onclick=()=>{page++;render();$('grid').querySelector('button')?.focus();};$('detail-close').onclick=closeDetails;$('watch').onclick=watch;$('account').onclick=openLogin;$('login-close').onclick=()=>{$('login').close();if($('details').open)focusDetail();else $('account').focus();};$('pin-close').onclick=()=>{$('pin').close();focusDetail();};$('player-go').onclick=playerOK;$('player-retry').onclick=watch;$('player-exit').onclick=stop;
 window.addEventListener('box-auth-expired',()=>{authorized=false;if(!$('player').hidden)stop();openLogin();text('login-message','Es necesario verificar tu suscripción para continuar.');});
 catalog('new');$('new').focus();
})();
