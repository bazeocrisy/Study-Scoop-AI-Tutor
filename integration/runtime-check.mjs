// Real workerd + Durable Object smoke test; never contacts a model provider.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createHmac,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const secret='public-test-fixture-only-not-a-real-signing-secret';
const payload=Buffer.from(JSON.stringify({lesson:'6-1',jti:randomUUID(),exp:Math.floor(Date.now()/1000)+3500})).toString('base64url');
const token=payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'cloudflare/tutor-worker/.runtime/worker.js',compatibilityDate:'2026-10-01',durableObjects:{TUTOR_SESSIONS:{className:'TutorSessions',useSQLite:true}},bindings:{SESSION_SIGNING_SECRET:secret,ALLOWED_ORIGINS:'https://allowed.test',AI_ENABLED:'false'}}));
const call=(body,bearer=token)=>mf.dispatchFetch('https://test/api/tutor',{method:'POST',headers:{origin:'https://allowed.test',authorization:'Bearer '+bearer,'content-type':'application/json'},body:JSON.stringify(body)});
try{
 assert.equal((await call({},'bad')).status,401);
 const input={action:'start',requestId:randomUUID(),revision:0};
 let r=await call(input);assert.equal(r.status,200);const first=await r.json();assert.equal(first.index,0);
 assert.deepEqual(await (await call(input)).json(),first);
 await new Promise(resolve=>setTimeout(resolve,320));
 r=await call({action:'answer',message:'inside',requestId:randomUUID(),revision:first.revision});
 assert.equal(r.status,200);assert.equal((await r.json()).index,1);
 await new Promise(resolve=>setTimeout(resolve,320));
 r=await call({action:'answer',message:'one',requestId:randomUUID(),revision:0});
 assert.equal(r.status,409);
 console.log('PASS: real workerd authorization, Durable Object state, idempotent replay, progression and stale-turn rejection (5 checks).');
}finally{await mf.dispose();}
