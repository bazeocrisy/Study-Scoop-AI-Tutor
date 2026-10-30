import test from 'node:test';
import assert from 'node:assert/strict';
import lesson from '../curriculum/6-1.json' with {type:'json'};
import {initialState,transition} from '../engine/controller.js';
import {voiceTurn} from '../engine/voice-turn.js';

test('Repeat and reconnect retain the actual reasoning follow-up',()=>{
 for(const index of [2,8]){
 let s={...initialState(),started:true,index};
 s=transition(s,{action:'answer',message:'I think so',revision:0},lesson).state;
 for(const action of ['repeat','start']){
 const {output}=transition(s,{action,revision:s.revision},lesson);
 assert.ok(output.speech.includes(output.question));
 assert.deepEqual(output.options,lesson.concepts[index].followUp.options);
 }
 }
});
test('Reasoning that begins with How is saved as an assessment response',()=>{
 const s={...initialState(),started:true,phase:'assess',index:7};
 const {state,output}=transition(s,{action:'answer',revision:0,message:'How tiling helps is that it covers the inside once.'},lesson);
 assert.equal(state.phase,'review');assert.equal(state.records.length,1);
 assert.equal(output.summary.total,0);assert.equal(state.records[0].correct,null);
});
test('Skipped reasoning stays unscored and clearly marked skipped',()=>{
 const s={...initialState(),started:true,phase:'assess',index:7};
 const {output}=transition(s,{action:'answer',revision:0,message:'skip this problem'},lesson);
 assert.equal(output.summary.total,0);assert.equal(output.summary.reasoning[0].status,'skipped');
});
test('voice collects multiple phrases without treating a silence as completion',()=>{
 let t=voiceTurn('','The squares cover');assert.equal(t.action,null);
 t=voiceTurn(t.draft,'all the inside');assert.equal(t.action,null);
 t=voiceTurn(t.draft,"I'm finished.");assert.equal(t.action,'answer');
 assert.equal(t.draft,'The squares cover all the inside');
});
test('voice explicit completion can share a phrase; commands preserve draft',()=>{
 assert.deepEqual(voiceTurn('','eight square units I am finished'),{draft:'eight square units',action:'answer'});
 assert.deepEqual(voiceTurn('eight',"I'm still thinking"),{draft:'eight',action:'pause'});
 assert.equal(voiceTurn('','I don’t understand').action,'help');
 assert.equal(voiceTurn('','Can you repeat that?').action,'repeat');
 assert.equal(voiceTurn('','finished').action,'finished');
});
test('alternative explanations and diagrams match their concepts',()=>{
 assert.equal(new Set(lesson.concepts.map(c=>c.example.text)).size,9);
 assert.equal(lesson.concepts.find(c=>c.id==='unit').example.visual.mode,'unit');
 assert.equal(lesson.concepts.find(c=>c.id==='reason').example.visual.mode,'circles');
 assert.equal(lesson.concepts.find(c=>c.id==='edge').check.accepted[0],'4');
});
