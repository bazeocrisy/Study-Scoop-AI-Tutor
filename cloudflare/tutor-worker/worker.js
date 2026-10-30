import lesson from '../../curriculum/6-1.json' with {type:'json'};
import {initialState,transition} from '../../engine/controller.js';
import {coach} from '../../engine/coach.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyToken(token,secret,now=Date.now()){
 try{if(typeof secret!=='string'||secret.length<32||token.length>2000)return null;const [payload,sig,...extra]=token.split('.');if(extra.length)return null;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('HMAC',key,decode(sig),new TextEncoder().encode(payload)))return null;const p=JSON.parse(new TextDecoder().decode(decode(payload)));const t=Math.floor(now/1000);return p.lesson==='6-1'&&/^[a-zA-Z0-9_-]{16,80}$/.test(p.jti)&&Number.isInteger(p.exp)&&p.exp>t&&p.exp<=t+3600?p:null;}catch{return null;}
}
export async function boundedJSON(request){const reader=request.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error('large')}chunks.push(value)}}finally{reader.releaseLock()}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(bytes));}
export default {async fetch(request,env){
 const origin=request.headers.get('origin');const ok=!!origin&&String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(origin);const cors=ok?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization'}:{vary:'Origin'};
 if(new URL(request.url).pathname==='/health'&&request.method==='GET')return json({ok:true,lesson:'6-1',mode:env.AI_ENABLED==='true'?'ai-enabled':'reviewed-explanations'});
 if(!ok)return json({error:'Origin not allowed'},403,cors);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/tutor')return json({error:'Not found'},404,cors);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');const claims=await verifyToken(token,env.SESSION_SIGNING_SECRET);if(!claims)return json({error:'Session expired or unauthorized. Ask your parent for a new session.'},401,cors);
 if(!env.TUTOR_SESSIONS)return json({error:'Service not configured'},503,cors);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415,cors);
 let input;try{input=await boundedJSON(request)}catch(e){return json({error:'Invalid or oversized request'},e.message==='large'?413:400,cors)}
 if(!input||typeof input!=='object'||Array.isArray(input)||!/^[a-zA-Z0-9_-]{16,80}$/.test(input.requestId||''))return json({error:'Invalid request'},400,cors);
 try{const id=env.TUTOR_SESSIONS.idFromName('lesson-6-1-budget');const result=await env.TUTOR_SESSIONS.get(id).fetch(new Request('https://internal/turn',{method:'POST',body:JSON.stringify({claims,input})}));return new Response(result.body,{status:result.status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}})}catch{return json({error:'Tutor unavailable. Your answer may be saved; retry the same turn.'},503,cors)}
}};
// One durable coordinator intentionally serializes the small parent pilot's state and hard quotas.
export class TutorSessions{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
 const {claims,input}=await request.json();const key='s:'+claims.jti;let saved=await this.ctx.storage.get(key);const fingerprint=JSON.stringify(input);
 if(saved?.lastId===input.requestId)return saved.fingerprint===fingerprint?json(saved.output):json({error:'Request ID reused'},409);
 const now=Date.now();if(claims.exp*1000<=now)return json({error:'Session expired'},401);
 if(saved&&now-saved.updated<300)return json({error:'Please wait a moment before retrying.'},429);
 if((saved?.turns||0)>=120)return json({error:'Session turn limit reached. Take a break.'},429);
 let result;try{result=transition(saved?.state||initialState(),input,lesson)}catch(e){return json({error:e.message==='Stale turn'?'Stale turn; reconnect to resume.':'Invalid turn'},e.message==='Stale turn'?409:400)}
 let output=result.output;
 if(result.needsCoach&&result.state.phase==='teach'&&this.env.AI_ENABLED==='true'){
  const day=new Date(now).toISOString().slice(0,10);const budgetKey='b:'+day;const used=await this.ctx.storage.get(budgetKey)||0;
  if(used<12&&(saved?.aiCalls||0)<4){await this.ctx.storage.put(budgetKey,used+1);const c=lesson.concepts[result.state.index];const response=await coach(c,input.message,this.env);output={...output,coachStatus:response.status};if(!result.state.checkVariant)output.speech=c[response.choice]+' '+c.check.question;result.aiCalled=true;}
  else output={...output,coachStatus:'budget-fallback'};
 }
 await this.ctx.storage.put(key,{state:result.state,expires:claims.exp*1000,updated:now,turns:(saved?.turns||0)+1,aiCalls:(saved?.aiCalls||0)+(result.aiCalled?1:0),lastId:input.requestId,fingerprint,output});await this.ctx.storage.setAlarm(now+60000);return json(output);
 });}
 async alarm(){const now=Date.now();const entries=await this.ctx.storage.list();let active=false;const today=new Date(now).toISOString().slice(0,10);for(const [k,v]of entries){if(k.startsWith('s:')){if(v.expires<=now)await this.ctx.storage.delete(k);else active=true;}if(k.startsWith('b:')&&k!=='b:'+today)await this.ctx.storage.delete(k);}if(active)await this.ctx.storage.setAlarm(now+60000);}
}
