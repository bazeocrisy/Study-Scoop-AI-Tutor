import {command} from './controller.js';

// Explicit end-of-turn: a speech service's phrase boundary is not the child's turn boundary.
export function voiceTurn(draft, phrase) {
 const text=String(phrase).trim();
 const intent=command(text);
 if(intent && intent!=='finished')return {draft,action:intent};
 const end=/\b(?:i['’]?m finished|i am finished|finished|im finished)\s*[.!?]*$/i;
 const finished=intent==='finished'||end.test(text);
 const words=finished?text.replace(end,'').trim():text;
 const next=[draft.trim(),intent==='finished'?'':words].filter(Boolean).join(' ').slice(0,500);
 return finished?{draft:next,action:next?'answer':'finished'}:{draft:next,action:null};
}
