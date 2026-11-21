const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../home-covers.js'),H=require('../home-features.js');
const movie=i=>({id:'temporary-'+i,tmdbId:100+i,titulo:'Estreno '+i,year:'2024',fechaEstreno:'2024-01-01',backdrop:'https://images.test/'+i+'.jpg',urlDrive:'https://drive.google.com/file/d/movie'+i+'/view'});
const movies=Array.from({length:7},(_,i)=>movie(i));
test('manual configuration requires one Estrenos reference and a valid HTTPS panorama',()=>{
 const config=C.make(movies.slice(0,1));assert.equal(config.items.length,1);assert.equal(config.source,'peliculas2.json');
 for(const list of [[],movies.slice(0,2),movies.slice(0,5),[movies[0],movies[0]]])assert.throws(()=>C.make(list));
 assert.throws(()=>C.validate({...config,source:'peliculas.json'}));
 assert.throws(()=>C.make(movies.slice(0,1).map((item,i)=>i?item:{...item,backdrop:'data:image/png,example'})));
});
test('references survive admin index changes, catalog reordering, title edits and Drive URL variants',()=>{
 assert.equal(C.key({...movies[0],id:'est-0'}),C.key({...movies[0],id:'est-76',titulo:'Título corregido'}));
 assert.equal(C.key({urlDrive:'https://drive.google.com/file/d/movie0/preview'}),C.key({url:'https://drive.google.com/uc?export=download&id=movie0'}));
 const selected=C.make(movies.slice(0,1)),reordered=[...movies].reverse().map((m,i)=>({...m,id:'new-'+i}));
 assert.deepEqual(C.resolve(selected,reordered).map(m=>m.tmdbId),[movies[0].tmdbId]);
});
test('manual home pool honors chosen older releases and custom panoramas rather than the latest automatic pool',async()=>{
 const config=C.make(movies.slice(0,1).map(m=>({...m,backdrop:'https://images.test/custom-'+m.tmdbId+'.jpg'})));
 const items=await H.load({movies2:movies,movies:[{...movies[6],titulo:'Otra sección'}]},{configuration:config,probe:async()=>({width:1920,height:1080}),random:()=>.999});
 assert.deepEqual(items.map(m=>m.tmdbId),[100]);assert.equal(H.panorama(items[0]),config.items[0].backdrop);
});
test('missing and invalid chosen covers never cause automatic or other-section substitutions',async()=>{
 const config=C.make(movies.slice(0,1));
 const items=await H.load({movies2:movies.slice(1),movies:[movies[0]]},{configuration:config,probe:async url=>url.endsWith('/2.jpg')?{width:900,height:1350}:{width:1920,height:1080},random:()=>.999});
 assert.deepEqual(items.map(m=>m.tmdbId),[]);
});
test('serialized configuration includes only curated public fields, and preserves Unicode',()=>{
 const config=C.make(movies.slice(0,1).map(m=>({...m,titulo:m.titulo+' 🎬 ñ',token:'never-copy',password:'never-copy'})));
 assert(!JSON.stringify(config).includes('never-copy'));assert.deepEqual(C.decode(C.encode(config)),config);
});
test('panoramic validation rejects vertical, square, empty and failed images',()=>{
 assert(C.panoramic({width:1920,height:1080}));for(const size of [null,{}, {width:900,height:1350},{width:1000,height:1000},{width:100,height:0}])assert(!C.panoramic(size));
});
test('GitHub publication targets only portadas-inicio.json and requires the current SHA',async()=>{
 const config=C.make(movies.slice(0,1));let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.github.com/repos/sejo48/StreamTube-V20/contents/portadas-inicio.json');assert.equal(options.method,'PUT');const body=JSON.parse(options.body);assert.equal(body.sha,'current-sha');assert.equal(body.branch,'main');assert.deepEqual(C.decode(body.content),config);assert(!body.content.includes('example-credential'));return {ok:true,json:async()=>({commit:{sha:'commit'},content:{sha:'new-sha'}})};};
 await assert.rejects(C.publish({token:'example-credential',config},fetcher));assert.equal(calls,0);
 await C.publish({token:'example-credential',config,sha:'current-sha'},fetcher);assert.equal(calls,1);
 await assert.rejects(C.publish({token:'example-credential',config,sha:'current-sha'},async()=>({ok:false,status:409})),/selección publicada cambió/);
 await assert.rejects(C.repository('example-credential',async()=>({ok:false,status:401})),/rechazó el token/);
});

test('legacy selections show only their first movie and migrate to a single selection without mutation',async()=>{
 const legacy={schemaVersion:1,source:C.SOURCE,mode:'manual',items:movies.slice(0,5).map(m=>({movieKey:C.key(m),title:C.title(m),backdrop:C.image(m)}))};
 const original=JSON.stringify(legacy);
 assert.equal(C.selection(legacy).length,1);
 assert.deepEqual(C.resolve(legacy,movies).map(m=>m.tmdbId),[100]);
 const migrated=C.make(C.selection(legacy));assert.equal(migrated.schemaVersion,2);assert.equal(migrated.items.length,1);
 for(const config of [legacy,migrated])for(const random of [()=>0,()=>.999]){
  const selected=await H.load({movies2:[...movies].reverse()},{configuration:config,previous:H.key(movies[0]),random,probe:async()=>({width:1920,height:1080})});
  assert.deepEqual(selected.map(m=>m.tmdbId),[100]);
 }
 assert.equal(JSON.stringify(legacy),original);
});
test('a broken manually chosen panorama never substitutes another movie',async()=>{
 const config=C.make([movies[0]]);
 for(const size of [null,{width:900,height:1350}])assert.deepEqual(await H.load({movies2:movies},{configuration:config,probe:async()=>size}),[]);
});
test('poster placement is validated, preserved on the chosen movie and included in revision checks',()=>{
 const legacy={schemaVersion:2,source:C.SOURCE,mode:'manual',updatedAt:'2026-01-01',items:[{movieKey:C.key(movies[0]),title:C.title(movies[0]),backdrop:C.image(movies[0])}]};
 const before=JSON.stringify(movies);
 assert.equal(C.selection(legacy)[0].posterPosition,'left');
 assert.equal(C.revision(legacy),JSON.stringify([legacy.mode,legacy.updatedAt,legacy.items.map(m=>[m.movieKey,m.title,m.backdrop])]));
 const revisions=[];
 for(const posterPosition of ['left','right','inline']){
  const config=C.make([{...movies[0],posterPosition}],'2026-01-01');
  const resolved=C.resolve(C.decode(C.encode(config)),movies);
  assert.equal(resolved.length,1);assert.equal(resolved[0].tmdbId,movies[0].tmdbId);assert.equal(resolved[0].homePosterPosition,posterPosition);
  revisions.push(C.revision(config));
 }
 assert.equal(new Set(revisions).size,3);
 for(const posterPosition of ['diagonal','',null])assert.throws(()=>C.make([{...movies[0],posterPosition}]),/posición válida/);
 assert.equal(JSON.stringify(movies),before);
});
