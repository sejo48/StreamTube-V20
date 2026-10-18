const {test}=require('node:test');const assert=require('node:assert/strict');const H=require('../home-features.js');
const content={movies2:Array.from({length:20},(_,i)=>({id:'p'+i,title:'Estreno '+i,year:'2026'})),movies:[{id:'m',title:'Película del catálogo',year:'1990'}],series:[{id:'s',title:'Serie del catálogo'}]};
test('complete Trends pool includes older titles and all catalog positions',()=>{
 const pool=H.pool(content);assert.equal(pool.length,22);assert(pool.some(x=>x.id==='p19'));assert(pool.some(x=>x.id==='m'));assert(pool.some(x=>x.id==='s'));
});
test('five unique highlights are drawn without mutating catalog order',()=>{
 const before=JSON.stringify(content),items=H.select(content,{random:()=>.3});
 assert.equal(items.length,5);assert.equal(new Set(items.map(H.key)).size,5);assert.equal(JSON.stringify(content),before);
});
test('every entry in the full catalog can become the leading cover',()=>{
 const winners=new Set();let seed=7;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<500;i++)winners.add(H.select(content,{random})[0].id);
 assert.equal(winners.size,H.pool(content).length);
});
test('consecutive reloads never repeat the previously displayed cover',()=>{
 let previous='';
 for(let i=0;i<30;i++){
  const items=H.select(content,{previous,random:()=>0});
  assert.notEqual(H.key(items[0]),previous);previous=H.key(items[0]);
 }
});
test('duplicate titles and blank entries do not create duplicate highlights',()=>{
 const result=H.pool({trends:[{title:'Una',year:'2026'},{titulo:'UNA',year:'2026'},{name:'Otra'},{},null]});
 assert.equal(result.length,2);
});
test('a single title and an empty catalog remain usable',()=>{
 assert.deepEqual(H.select({}),[]);assert.equal(H.select({trends:[{title:'Única'}]},{previous:H.key({title:'Única'})}).length,1);
});
