import {validate} from './validation.mjs';
const origins = new Set(['https://firelandsunited.com','https://www.firelandsunited.com']);
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if (origins.has(origin)) Object.assign(headers, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
    const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
    if (!origins.has(origin)) return reply({ok:false,message:'Origin not allowed.'},403);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (request.method!=='POST') return reply({ok:false,message:'Method not allowed.'},405);
    if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'})).success) return reply({ok:false,message:'Too many attempts. Please wait a minute and try again.'},429);
    if (!env.SHEETS_URL || !env.SHEETS_SECRET) return reply({ok:false,message:'Registration is not open yet.'},503);
    if (!(request.headers.get('Content-Type')||'').includes('application/json')) return reply({ok:false,message:'Invalid request.'},415);
    let input;
    try {
      const reader=request.body.getReader(); let size=0; const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();return reply({ok:false,message:'Registration is too large.'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      input=JSON.parse(new TextDecoder().decode(bytes));
    } catch { return reply({ok:false,message:'Invalid registration.'},400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ok:false,message:'Invalid registration.'},400);
    if (input.website) return reply({ok:false,message:'Unable to accept registration.'},400);
    let data;
    try { data=validate(input); } catch(error){return reply({ok:false,message:error.message},400);}
    try {
      // Bind upstream deduplication to the answers as well as the browser ID.
      // Changed answers must never receive success for a different saved registration.
      const clientId=data.registrationId;
      const identity={...data,playerSignatureDate:'',guardianDate:''};
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identity)));
      data.registrationId=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
      const timestamp=new Date().toISOString();
      const payload=JSON.stringify({data,timestamp,releaseHash:env.RELEASE_HASH});
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SHEETS_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
      const signature=[...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');
      const response=await fetch(env.SHEETS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature}),signal:AbortSignal.timeout(25000)});
      if (!response.ok) throw new Error('upstream');
      const result=await response.json();
      if (!result.ok || result.registrationId!==data.registrationId) throw new Error('upstream');
      return reply({ok:true,registrationId:clientId});
    } catch { return reply({ok:false,message:'We could not confirm your registration. Your answers are still here. Please try again.'},503); }
  }
};
