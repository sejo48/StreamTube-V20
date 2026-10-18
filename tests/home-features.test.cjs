const {test}=require('node:test');const assert=require('node:assert/strict');const H=require('../home-features.js');
const day='2026-10-18';
const release=(id,date,extra={})=>({id,title:id,year:date.slice(0,4),fechaEstreno:date,backdrop:'https://images.test/'+id,...extra});
const content={movies2:[release('older','2025-12-01'),...Array.from({length:8},(_,i)=>release('new'+i,'2026-10-'+String(17-i).padStart(2,'0')))],movies:[release('wrong-movie-section','2026-10-18')],series:[release('wrong-series-section','2026-10-18')],trends:[release('wrong-trends-section','2026-10-18')]};
const wide=async()=>({width:1920,height:1080});
test('discovery Trends pool remains independent of hero restrictions',()=>{
 assert.deepEqual(H.pool(content),content.trends);
 const full=H.pool({...content,trends:[]});assert.equal(full.length,11);assert(full.some(x=>x.id==='wrong-series-section'));
});
test('hero uses only the latest five Estrenos, regardless of insertion order',async()=>{
 const before=JSON.stringify(content),items=await H.load(content,{day,probe:wide,random:()=>.3});
 assert.deepEqual(items.map(x=>x.id).sort(),['new0','new1','new2','new3','new4']);
 assert.equal(new Set(items.map(H.key)).size,5);assert.equal(JSON.stringify(content),before);
});
test('missing backgrounds never fall back to posters, synthesized backdrops or other sections',async()=>{
 const input={movies2:[release('poster-only','2026-10-17',{backdrop:'',image:'poster.jpg'}),release('normalized-poster','2026-10-16',{panoramicImage:'',backdrop:'poster.jpg'}),release('banner','2026-10-15',{backdrop:'',banner:'wide.jpg'})],movies:content.movies};
 assert.deepEqual((await H.load(input,{day,probe:wide})).map(x=>x.id),['banner']);
});
test('rejects portrait, square, broken and failed images and fills from next newest Estrenos',async()=>{
 const input={movies2:['portrait','square','broken','throws','wide','wider'].map((id,i)=>release(id,'2026-10-'+String(17-i).padStart(2,'0')))};
 const probe=async url=>{const id=url.split('/').pop();if(id==='throws')throw Error('offline');return {portrait:{width:900,height:1350},square:{width:1000,height:1000},broken:null,wide:{width:1920,height:1080},wider:{width:2400,height:800}}[id];};
 assert.deepEqual((await H.load(input,{day,probe,random:()=>.999})).map(x=>x.id),['wide','wider']);
});
test('date validation excludes future, invalid and undated releases; supports a year fallback',()=>{
 const input={movies2:[release('future','2027-01-01'),release('invalid','2026-02-30'),release('no-date','',{year:''}),release('year-only','',{year:'2026'}),release('today',day)]};
 assert.deepEqual(H.candidates(input,{day}).map(x=>x.id),['today','year-only']);
});
test('consecutive reloads avoid the previous visible cover within the newest five',async()=>{
 let previous='';
 for(let i=0;i<20;i++){
  const items=await H.load(content,{day,probe:wide,previous,random:()=>0});assert.notEqual(H.key(items[0]),previous);previous=H.key(items[0]);
 }
});
test('duplicates, empty catalogs, all-invalid images and a singleton are safe',async()=>{
 const one=release('one','2026-10-17');
 assert.equal((await H.load({movies2:[one,{...one,id:'duplicate'},null,{}]},{day,probe:wide})).length,1);
 assert.deepEqual(await H.load({}, {day,probe:wide}),[]);
 assert.deepEqual(await H.load(content, {day,probe:async()=>null}),[]);
});
test('cancelled refresh stops validation and returns no stale selection',async()=>{
 let cancelled=false,calls=0;
 const items=await H.load(content,{day,isCancelled:()=>cancelled,probe:async()=>{calls++;cancelled=true;return {width:1920,height:1080};}});
 assert.deepEqual(items,[]);assert.equal(calls,5);
});
