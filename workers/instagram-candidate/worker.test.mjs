import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {newest,refresh} from './worker.mjs';
test('sorts own and collaborative posts and ignores unrelated posts',()=>{
 assert.equal(newest([{shortCode:'a',timestamp:'2026-01-01',ownerUsername:'firelandsunited'},{shortCode:'b',timestamp:'2026-02-01',coauthorProducers:[{username:'firelandsunited'}]},{shortCode:'c',timestamp:'2026-03-01',ownerUsername:'other'}]).shortCode,'b');
});
function env(state) {const map=new Map([['state',state],['feed',{post:{timestamp:'2026-01-01',image:'/media/old/id'}}]]);return {APIFY_TOKEN:'test',CACHE:{get:async k=>map.get(k),put:async(k,v)=>map.set(k,JSON.parse(v))},map};}
test('recent checks do not call Apify again',async()=>{const now=new Date('2026-11-11T14:00:00Z');const e=env({});e.map.set('checkedAt',+now);await refresh(e,now);assert.equal(e.map.size,3);});
test('failed read preserves previous feed without retry',async()=>{const e=env({});const original=globalThis.fetch;let calls=0;globalThis.fetch=async(u,options)=>{calls++;assert.equal(options.method,'GET');return new Response('',{status:403});};try{await refresh(e,new Date('2026-11-11'));assert.equal(calls,1);assert.equal(e.map.get('feed').post.image,'/media/old/id');assert.equal(e.map.get('state').status,'failed');}finally{globalThis.fetch=original;}});
test('public endpoint cannot trigger a run',async()=>{assert.equal((await worker.fetch(new Request('https://test/refresh',{method:'POST'}),{})).status,405);});
test('older result cannot replace saved post',async()=>{const e=env({});const original=globalThis.fetch;globalThis.fetch=async u=>Response.json(u.includes('/runs?')?{data:{items:[{id:'run',status:'SUCCEEDED',defaultDatasetId:'dataset'}]}}:[{shortCode:'old',timestamp:'2025-01-01',ownerUsername:'firelandsunited'}]);try{await refresh(e,new Date('2026-11-11'));assert.equal(e.map.get('state').error,'Older result rejected');assert.equal(e.map.get('feed').post.image,'/media/old/id');}finally{globalThis.fetch=original;}});
test('caches image before publishing a successful manifest',async()=>{
 const e=env({});const writes=[];e.CACHE.put=async(k,v)=>{writes.push(k);e.map.set(k,v instanceof Uint8Array?v:JSON.parse(v));};e.CACHE.delete=async k=>e.map.delete(k);
 const original=globalThis.fetch;globalThis.fetch=async(u,options)=>{
  assert.notEqual(options.method,'POST');
  if(u.toString().includes('/runs?')) return Response.json({data:{items:[{id:'newrun',status:'SUCCEEDED',defaultDatasetId:'d'}]}});
  if(u.toString().includes('/datasets/')) return Response.json([{shortCode:'new',timestamp:'2026-11-11',ownerUsername:'firelandsunited',displayUrl:'https://a.cdninstagram.com/image.jpg'}]);
  assert.equal(options.redirect,'manual');return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
 };
 try {await refresh(e,new Date('2026-11-11'));assert.equal(e.map.get('state').status,'succeeded');assert(writes.indexOf('media/new/newrun')<writes.indexOf('feed'));assert.equal(e.map.get('feed').post.image,'/media/new/newrun');} finally{globalThis.fetch=original;}
});
