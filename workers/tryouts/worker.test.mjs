import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,webcrypto} from 'node:crypto';
import worker from './worker.mjs';
import {flushPending} from './outbox.mjs';
import {RELEASE_VERSION} from './validation.mjs';
const valid={team:'women',registrationId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',releaseVersion:RELEASE_VERSION,fullName:'Test Player',email:'test@example.com',phone:'555-0100',homeAddress:'Test address',dateOfBirth:'2000-01-01',availability:'Yes',positions:'Goalkeeper',secondaryPosition:'None',height:'170 cm',dominantFoot:'Right Footed',experience:'Test',motivation:'Test',emergencyName:'Test Contact',emergencyRelationship:'Parent',emergencyPhone:'555-0101',releaseName:'Test Player',playerSignature:'TEST ONLY'};
function database() {
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 return {prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {run:async()=>stmt.run(...args),first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)})}}}},db};
}
async function submit(data, config=env, wait=true){const tasks=[];const response=await worker.fetch(request(data),config,{waitUntil:p=>tasks.push(p)});if(wait)await Promise.all(tasks);return response;}
const env={SHEETS_URL:'https://example.com',SHEETS_SECRET:'test-only',RELEASE_HASH:'test',RATE_LIMITER:{limit:async()=>({success:true})},REGISTRATIONS:database()};
const request=(data,origin='https://firelandsunited.com')=>new Request('https://example.com',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
test('origin, malformed input, honeypot, size, and rate protection',async()=>{
 assert.equal((await worker.fetch(request(valid,'https://evil.example'),env)).status,403);
 for(const data of [null,[],{...valid,website:'bot'}])assert.equal((await submit(data)).status,400);
 assert.equal((await worker.fetch(request({...valid,motivation:'x'.repeat(25000)}),env)).status,413);
 assert.equal((await worker.fetch(request(valid),{...env,RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
test('signed upstream requests bind retry identity to normalized answers',async()=>{
 const original=globalThis.fetch;const payloads=[];const config={...env,REGISTRATIONS:database()};
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);const data=JSON.parse(body.payload).data;payloads.push(data);const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.SHEETS_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);assert.equal(await webcrypto.subtle.verify('HMAC',key,Buffer.from(body.signature,'hex'),new TextEncoder().encode(body.payload)),true);return Response.json({ok:true,registrationId:data.registrationId});};
 try{for(const data of [valid,valid,{...valid,motivation:'Changed'}]){const r=await submit(data,config);assert.equal(r.status,200);assert.equal((await r.json()).registrationId,valid.registrationId);}assert.equal(payloads.length,2);assert.notEqual(payloads[0].registrationId,payloads[1].registrationId);}finally{globalThis.fetch=original;}
});
test('Google failure still accepts a durably saved registration, then scheduled retry syncs it once',async()=>{
 const original=globalThis.fetch;const config={...env,REGISTRATIONS:database()};let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:false});};
 try{const response=await submit(valid,config);assert.equal(response.status,200);let row=config.REGISTRATIONS.db.prepare('SELECT * FROM registrations').get();assert.equal(row.synced_at,null);assert.equal(row.last_error,'google_not_confirmed');assert.equal(calls,2);
 globalThis.fetch=async(url,options)=>{calls++;const data=JSON.parse(JSON.parse(options.body).payload).data;return Response.json({ok:true,registrationId:data.registrationId});};
 config.REGISTRATIONS.db.exec('UPDATE registrations SET next_attempt=0');await flushPending(config);row=config.REGISTRATIONS.db.prepare('SELECT * FROM registrations').get();assert.ok(row.synced_at);assert.equal(row.last_error,null);await flushPending(config);assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});
test('storage failures never claim registration success',async()=>{
 const response=await submit(valid,{...env,REGISTRATIONS:{prepare(){throw Error('database down');}}});assert.equal(response.status,503);assert.equal((await response.json()).ok,false);
});
test('identical browser retries persist once and never send a second confirmed sheet write',async()=>{
 const config={...env,REGISTRATIONS:database()},original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;const data=JSON.parse(JSON.parse(options.body).payload).data;return Response.json({ok:true,registrationId:data.registrationId});};
 try{await submit(valid,config);await submit(valid,config);assert.equal(config.REGISTRATIONS.db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n,1);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('archived release matches displayed release and configured hash',()=>{
 const html=readFileSync(new URL('../../tryouts/index.html',import.meta.url),'utf8');const archive=readFileSync(new URL('./release-2027.html',import.meta.url),'utf8');
 const release=html.match(/<div class="tryout-release">(.*?)<\/div>/s)[1];const terms=html.match(/<small id="playerSignature-help">(.*?)<\/small>/s)[1];
 assert.equal(archive,release+'\n<p>'+terms+'</p>\n');
 assert.ok(readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8').includes(createHash('sha256').update(archive).digest('hex')));
});
