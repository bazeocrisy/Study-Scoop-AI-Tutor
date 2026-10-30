// Pure lesson controller shared by browser demo and authoritative Worker.
export const normalize = x => String(x ?? '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const numbers=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
export function numeric(x){if(/[−–—\-]|\d\.\d/.test(String(x)))return NaN;let s=normalize(x).replace(/^(the area is |it is |its |i think |my answer is )/,'').replace(/ (square units?|units?)$/,'');return /^\d+$/.test(s)?Number(s):numbers.includes(s)?numbers.indexOf(s):NaN;}
export function command(x){const s=normalize(x);if(/^(repeat|can you repeat that|say that again|repeat that)$/.test(s))return 'repeat';if(/^(pause|im still thinking|i am still thinking|still thinking|wait)$/.test(s))return 'pause';if(/^(stop|stop listening)$/.test(s))return 'stop';if(/^(help|i dont understand|i do not understand|show me another example|another example|why do we do that|why)$/.test(s))return 'help';if(/^(im finished|i am finished|finished|done)$/.test(s))return 'finished';return null;}
export function initialState(){return {phase:'teach',index:0,revision:0,attempts:0,assisted:[],records:[],reasoning:[],paused:false,started:false,checkVariant:false};}
const item=(s,l)=>s.phase==='review'?null:s.phase==='assess'?l.assessment[s.index]:l.concepts[s.index];
export function view(s,l,speech){const q=item(s,l);return {phase:s.phase,index:s.index,revision:s.revision,paused:s.paused,started:s.started,title:q?.name || (s.phase==='review'?'Your learning story':'Your independent turn'),speech:speech??(s.phase==='teach'?q.teach+' '+(s.checkVariant?q.followUp.question:q.check.question):q?.question||''),question:s.phase==='teach'?(s.checkVariant?q.followUp.question:q.check.question):q?.question,options:s.checkVariant?q.followUp.options:q?.check?.options||q?.options||null,visual:q?.visual||null,kind:s.checkVariant?'exact':q?.check?.kind||q?.kind,progress:s.phase==='teach'?`${s.index+1} of ${l.concepts.length} teaching ideas`:s.phase==='assess'?`${s.index+1} of ${l.assessment.length} independent problems`:'Lesson complete',summary:s.phase==='review'?summary(s,l):null};}
export function summary(s,l){const scored=s.records.filter(r=>r.correct!==null);return {correct:scored.filter(r=>r.correct).length,total:scored.length,assistedConcepts:s.assisted,reasoning:s.reasoning,records:s.records.map(r=>({...r,expected:l.assessment.find(q=>q.id===r.id)?.answer,feedback:l.assessment.find(q=>q.id===r.id)?.feedback})),judgment:'A single lesson is limited evidence. Review the explanation with a parent and revisit these skills on another day before claiming mastery.'};}
function connected(cells){if(!cells.length)return false;const all=new Set(cells),seen=new Set([cells[0]]),stack=[cells[0]];while(stack.length){const i=stack.pop();for(const n of [i-4,i+4,...(i%4?[i-1]:[]),...(i%4<3?[i+1]:[])])if(all.has(n)&&!seen.has(n)){seen.add(n);stack.push(n);}}return seen.size===all.size;}
export function completeTiling(v,filled){const needed=[];v.rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='X'&&v.visible[y][x]==='.')needed.push(y*r.length+x)}));return Array.isArray(filled)&&filled.length===needed.length&&new Set(filled).size===needed.length&&needed.every(i=>filled.includes(i));}
export function grade(q,message,cells,filled){if(q.visual?.mode==='partial'&&!completeTiling(q.visual,filled))return false;if(q.kind==='reason')return null;if(q.kind==='build')return Array.isArray(cells)&&cells.length===q.answer&&new Set(cells).size===cells.length&&cells.every(i=>Number.isInteger(i)&&i>=0&&i<12)&&connected(cells);if(q.kind==='number')return numeric(message)===q.answer;return normalize(message)===normalize(q.answer);}
export function transition(state,input,lesson){let s=structuredClone(state);if(!input||typeof input.action!=='string')throw Error('Invalid action');if(input.action!=='start'&&input.revision!==s.revision)throw Error('Stale turn');if(input.message!==undefined&&(typeof input.message!=='string'||input.message.length>500))throw Error('Invalid message');
const action=input.action;const known=['start','answer','help','repeat','pause','resume','stop','question'];if(!known.includes(action))throw Error('Invalid action');
if(action==='start'){s.started=true;return {state:s,output:view(s,lesson)}}
if(!s.started)throw Error('Start instruction first');
if(s.phase==='review')return {state:s,output:view(s,lesson,'You finished. Your parent can review your work below.')};
const intent=action==='answer'?command(input.message):null;let a=intent||action;if(s.phase==='teach'&&a==='answer'&&/^(why|how|what does|can you explain|could you explain)\b/i.test(input.message))a='question';const q=item(s,lesson);
if(a==='pause'||a==='stop'){s.paused=true;s.revision++;return {state:s,output:view(s,lesson,'Take your time. Use Resume when you are ready.')}}
if(a==='resume'){s.paused=false;s.revision++;return {state:s,output:view(s,lesson)}}
if(s.paused)return {state:s,output:view(s,lesson,'I am paused. Use Resume when you are ready.')};
if(a==='repeat')return {state:s,output:view(s,lesson)};
if(a==='finished')return {state:s,output:view(s,lesson,'Send your answer when you are ready. You may also say: skip this problem.')};
if(a==='help'||a==='question'){
 if(s.phase==='assess')return {state:s,output:view(s,lesson,'This is your independent turn. I can repeat the question, but I will save help until the review. You may say: skip this problem.')};
 if(!s.assisted.includes(q.id))s.assisted.push(q.id);s.revision++;
 return {state:s,output:{...view(s,lesson,q.alternative+' '+q.example.text+' '+(s.checkVariant?q.followUp.question:q.check.question)),example:q.example},needsCoach:a==='question'};
}
if(a!=='answer')throw Error('Invalid action');if(typeof input.message!=='string'||!input.message.trim())throw Error('Empty response');
if(s.phase==='assess'){
 const skip=normalize(input.message)==='skip this problem';const correct=q.kind==='reason'?null:skip?false:grade(q,input.message,input.cells,input.filled);
 s.records.push({id:q.id,skill:q.skill,response:input.message,cells:q.kind==='build'?input.cells||[]:undefined,filled:q.visual?.mode==='partial'?input.filled||[]:undefined,correct,independent:true,skipped:skip});if(q.kind==='reason')s.reasoning.push({id:q.id,response:input.message,status:skip?'skipped':'parent-review'});
 s.index++;s.revision++;if(s.index>=lesson.assessment.length){s.phase='review';s.index=0;return {state:s,output:view(s,lesson,'You finished your independent work. Let us review it with your parent.')}}
 return {state:s,output:view(s,lesson,'Answer saved. '+lesson.assessment[s.index].question)};
}
let good=false;let clarify=false;
if(s.checkVariant)good=normalize(input.message)===normalize(q.followUp.answer);
else if(q.check.kind==='reason'){
 s.reasoning.push({id:q.id,response:input.message,status:'unverified'});s.checkVariant=true;clarify=true;
}else if(q.check.kind==='build')good=grade({kind:'build',answer:8},input.message,input.cells);
else {const values=q.check.accepted.map(numeric).filter(Number.isFinite);good=values.length?values.includes(numeric(input.message)):q.check.accepted.some(x=>normalize(x)===normalize(input.message));}
if(q.visual?.mode==='partial'&&!completeTiling(q.visual,input.filled))good=false;
s.revision++;
if(clarify)return {state:s,output:view(s,lesson,'Thank you for explaining. I will keep your explanation for your parent. Let us check the idea another way. '+q.followUp.question)};
if(!good){s.attempts++;if(!s.assisted.includes(q.id))s.assisted.push(q.id);return {state:s,output:{...view(s,lesson,(s.attempts>1?'Let us use a different picture in our minds. ':'Let us work on that together. ')+q.alternative+' '+q.example.text+' '+(s.checkVariant?q.followUp.question:q.check.question)),example:q.example}};}
s.index++;s.attempts=0;s.checkVariant=false;
if(s.index>=lesson.concepts.length){s.phase='assess';s.index=0;return {state:s,output:view(s,lesson,'You have worked through the teaching. Now solve these on your own. I will save feedback until you finish. '+lesson.assessment[0].question)}}
return {state:s,output:view(s,lesson,'That matches this idea. '+lesson.concepts[s.index].teach+' '+lesson.concepts[s.index].check.question)};
}
