// Prototype Cloudflare Worker. Parent-only evaluation until child privacy review.
import curriculum from '../../curriculum/6-1.json';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const allowed=(origin,env)=>String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(origin);
const correct=(c,value)=>c.check.accepted.length>0&&c.check.accepted.some(x=>normalize(x)===normalize(value));
const limit=800;
async function generate(c,question,env){
 if(!env.ANTHROPIC_API_KEY)throw Error('AI not configured');
 const prompt='You are a patient, concise third-grade math tutor. Teach the supplied concept only. Answer the child question in no more than 75 words. Do not provide the answer to the check question. Do not pretend to be a real human. Do not ask for personal details. Return only your spoken response.';
 const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:env.MODEL||'claude-sonnet-4-5',max_tokens:240,system:prompt,messages:[{role:'user',content:JSON.stringify({concept:c.name,explanation:c.teach,checkQuestion:c.check.question,studentQuestion:question})}]})});
 if(!response.ok)throw Error('Model service failed');
 const result=await response.json();const speech=(result.content||[]).filter(x=>x.type==='text').map(x=>x.text).join(' ').trim();
 if(!speech)throw Error('No model text');return speech.slice(0,limit);
}
export default {async fetch(request,env){
 const origin=request.headers.get('origin')||'';const cors=allowed(origin,env)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, x-parent-key'}:{'vary':'Origin'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(new URL(request.url).pathname==='/health')return json({ok:true,lesson:curriculum.id,aiConfigured:!!env.ANTHROPIC_API_KEY},200,cors);
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/tutor')return json({error:'Not found'},404,cors);
 if(!allowed(origin,env))return json({error:'Origin not allowed'},403,cors);
 // Shared parent passphrase is temporary, not suitable as child account authentication.
 if(!env.PARENT_PASSPHRASE||request.headers.get('x-parent-key')!==env.PARENT_PASSPHRASE)return json({error:'Unauthorized'},401,cors);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Too large'},413,cors);
 let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400,cors)}
 const idx=Number(input.conceptIndex);if(!Number.isInteger(idx)||idx<0||idx>=curriculum.concepts.length)return json({error:'Invalid concept index'},400,cors);
 const concept=curriculum.concepts[idx];const action=String(input.action||'');
 if(action==='start')return json({action:'ask',speech:concept.teach+' '+concept.check.question,visual:concept.visual||null},200,cors);
 if(action==='answer'){
  if(!concept.check.accepted.length)return json({action:'needs-review',speech:'Tell me how you worked that out. A parent can review your explanation.',concept:concept.id},200,cors);
  const yes=correct(concept,input.message);
  return json({action:yes?'advance':'retry',correct:yes,speech:yes?'Good thinking! You can move to the next idea.':'Let us try another way. '+concept.teach+' '+concept.check.question},200,cors);
 }
 if(action==='question'){const message=String(input.message||'').trim().slice(0,500);if(!message)return json({error:'Empty question'},400,cors);try{return json({action:'explain',speech:await generate(concept,message,env),concept:concept.id},200,cors)}catch{return json({error:'AI temporarily unavailable'},503,cors)}}
 return json({error:'Invalid action'},400,cors);
}};
