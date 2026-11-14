import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import worker from './worker.mjs';
import {RELEASE_VERSION} from './validation.mjs';
const valid={team:'women',registrationId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',releaseVersion:RELEASE_VERSION,fullName:'Test Player',email:'test@example.com',phone:'555-0100',homeAddress:'Test address',dateOfBirth:'2000-01-01',availability:'Yes',positions:'Goalkeeper',secondaryPosition:'None',height:'170 cm',dominantFoot:'Right Footed',experience:'Test',motivation:'Test',emergencyName:'Test Contact',emergencyRelationship:'Parent',emergencyPhone:'555-0101',releaseName:'Test Player',playerSignature:'TEST ONLY'};
const env={SHEETS_URL:'https://example.com',SHEETS_SECRET:'test-only',RELEASE_HASH:'test',RATE_LIMITER:{limit:async()=>({success:true})}};
const request=(data,origin='https://firelandsunited.com')=>new Request('https://example.com',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
test('origin, malformed input, honeypot, size, and rate protection',async()=>{
 assert.equal((await worker.fetch(request(valid,'https://evil.example'),env)).status,403);
 for(const data of [null,[],{...valid,website:'bot'}])assert.equal((await worker.fetch(request(data),env)).status,400);
 assert.equal((await worker.fetch(request({...valid,motivation:'x'.repeat(25000)}),env)).status,413);
 assert.equal((await worker.fetch(request(valid),{...env,RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
test('signed upstream requests bind retry identity to normalized answers',async()=>{
 const original=globalThis.fetch;const payloads=[];
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);const data=JSON.parse(body.payload).data;payloads.push(data);const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.SHEETS_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);assert.equal(await webcrypto.subtle.verify('HMAC',key,Buffer.from(body.signature,'hex'),new TextEncoder().encode(body.payload)),true);return Response.json({ok:true,registrationId:data.registrationId});};
 try{for(const data of [valid,valid,{...valid,motivation:'Changed'}]){const r=await worker.fetch(request(data),env);assert.equal(r.status,200);assert.equal((await r.json()).registrationId,valid.registrationId);}assert.equal(payloads[0].registrationId,payloads[1].registrationId);assert.notEqual(payloads[0].registrationId,payloads[2].registrationId);}finally{globalThis.fetch=original;}
});
test('upstream failures never show success',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:false});try{assert.equal((await worker.fetch(request(valid),env)).status,503);}finally{globalThis.fetch=original;}});
test('archived release matches displayed release and configured hash',()=>{
 const html=readFileSync(new URL('../../tryouts/index.html',import.meta.url),'utf8');const archive=readFileSync(new URL('./release-2027.html',import.meta.url),'utf8');
 const release=html.match(/<div class="tryout-release">(.*?)<\/div>/s)[1];const terms=html.match(/<small id="playerSignature-help">(.*?)<\/small>/s)[1];
 assert.equal(archive,release+'\n<p>'+terms+'</p>\n');
 assert.ok(readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8').includes(createHash('sha256').update(archive).digest('hex')));
});
