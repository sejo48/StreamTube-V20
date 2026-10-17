const {test}=require('node:test');const assert=require('node:assert/strict');const F=require('../radio-favorites.js');
const catalog=[{id:'a',title:'Una',url:'https://radio.test/a',image:'a.png'},{id:'b',title:'Dos',url:'https://radio.test/b'}];
test('legacy names, stream URLs, IDs and Spanish fields recover one canonical record',()=>{
 const result=F.normalize(['a','Dos',{titulo:'Una',logo:'old.png'},{urlStream:'https://radio.test/b',nombre:'Dos'}],catalog);
 assert.deepEqual(result.items.map(x=>x.id),['a','b']);assert.equal(result.items[0].image,'a.png');assert.equal(result.rejected.length,0);
});
test('blank records never compare as one radio or become selectable cards',()=>{
 const result=F.normalize([{},{},null,false,[],{type:'radio'},{id:'unresolved'}],catalog);
 assert.equal(result.items.length,0);assert.equal(result.rejected.length,7);assert.equal(F.key({}),'');assert.equal(F.key(null),'');
});
test('unidentified but named stations get distinct stable IDs and keep names and logos',()=>{
 const raw=[{titulo:'Tres',urlStream:'https://radio.test/3',logo:'3.png'},{nombre:'Cuatro',stream:'https://radio.test/4'},{name:'Cinco',url:'https://radio.test/5'}];
 const first=F.normalize(raw).items,second=F.normalize([...raw].reverse()).items;
 assert.equal(new Set(first.map(F.key)).size,3);assert.deepEqual(first.map(x=>x.title),['Tres','Cuatro','Cinco']);
 assert.equal(first[0].image,'3.png');assert.equal(first[0].id,second[2].id);
});
test('a named favorite missing from the catalog is retained with a distinct identity',()=>{
 const r=F.normalize([{titulo:'Emisora antigua'},{title:'Otra antigua'}],catalog);
 assert.equal(r.items.length,2);assert.notEqual(r.items[0].id,r.items[1].id);assert.equal(r.items[0].url,'');
});
test('URL matching migrates an old generated ID after catalog reorder',()=>{
 const r=F.normalize([{id:'radio-fetched-35-old',title:'Dos',url:'https://radio.test/b'}],catalog);
 assert.equal(r.items[0].id,'b');
});

test('different meaningful records with a copied ID remain separate favorites',()=>{
 const r=F.normalize([{id:'copied',title:'Una',url:'https://radio.test/1'},{id:'copied',title:'Otra',url:'https://radio.test/2'}]);
 assert.equal(r.items.length,2);assert.notEqual(r.items[0].id,r.items[1].id);
});
