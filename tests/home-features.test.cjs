const {test}=require('node:test');const assert=require('node:assert/strict');const H=require('../home-features.js');
const now=new Date('2026-10-18T04:00:00Z');
test('latest premieres lead the carousel independent of insertion order',()=>{
 const input=[{title:'Vieja',fechaEstreno:'2026-01-01'},{title:'Nueva',fechaEstreno:'2026-10-17'},{title:'Intermedia',fechaEstreno:'2026-09-20'}];
 assert.deepEqual(H.select({movies2:input},now).map(x=>x.title),['Nueva','Intermedia','Vieja']);assert.equal(input[0].title,'Vieja');
});
test('future releases are excluded using the current date in Costa Rica',()=>{
 const result=H.select({movies2:[{title:'Hoy',fechaEstreno:'2026-10-17'},{title:'Mañana',fechaEstreno:'2026-10-18'},{title:'Futuro',year:'2027'}]},now);
 assert.deepEqual(result.map(x=>x.title),['Hoy']);
});
test('five premieres are selected before falling back to other catalog sections',()=>{
 const movies2=Array.from({length:7},(_,i)=>({title:'Estreno '+i,fechaEstreno:`2026-10-${String(i+1).padStart(2,'0')}`}));
 assert.deepEqual(H.select({movies2,movies:[{title:'Otra',fechaEstreno:'2026-10-17'}]},now).map(x=>x.title),['Estreno 6','Estreno 5','Estreno 4','Estreno 3','Estreno 2']);
});
test('undated ties retain catalog order; duplicate titles do not fill multiple slots',()=>{
 const result=H.select({movies2:[{title:'Uno',year:'2026'},{title:'Dos',year:'2026'},{title:'Sin fecha'}],movies:[{title:'Uno',year:'2026'},{title:'Tres'}]},now);
 assert.deepEqual(result.map(x=>x.title),['Uno','Dos','Sin fecha','Tres']);
});
test('date aliases are supported and invalid dates do not outrank valid dates',()=>{
 assert.equal(H.releaseDay({fechaEstreno:'2026-02-30'}),'');
 assert.equal(H.releaseDay({release_date:'2026-10-10'}),'2026-10-10');
 assert.equal(H.releaseDay({releaseDate:'2026-10-10T12:00:00Z'}),'2026-10-10');
});
