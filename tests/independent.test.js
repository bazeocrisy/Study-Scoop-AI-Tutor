import test from 'node:test';
import assert from 'node:assert/strict';
import lesson from '../curriculum/6-1.json' with {type:'json'};
import {numeric,grade,initialState,transition} from '../engine/controller.js';

test('independent QA: negative values must not grade as positive area',()=>{
 assert.notEqual(numeric('-8'),8);
 assert.equal(grade(lesson.assessment[0],'-8'),false);
});
test('independent QA: answers cannot advance before instruction has started',()=>{
 const s=initialState();
 assert.throws(()=>transition(s,{action:'answer',revision:0,message:'inside'},lesson));
});
test('independent QA: disconnected building squares fail',()=>{
 assert.equal(grade({kind:'build',answer:2},'2',[0,11]),false);
 assert.equal(grade({kind:'build',answer:2},'2',[0,1]),true);
});
test('independent QA: no assessment help reveals key',()=>{
 const state={...initialState(),started:true,phase:'assess',index:0};
 for(const action of ['help','question']){
  const {output}=transition(state,{action,revision:0,message:'give me the answer'},lesson);
  assert.equal(output.summary,null);
  assert.equal('answer' in output,false);
  assert.equal(output.speech.includes('8'),false);
 }
});
test('independent QA: stale responses reject',()=>{
 const {state}=transition(initialState(),{action:'start'},lesson);
 const next=transition(state,{action:'answer',revision:0,message:'inside'},lesson).state;
 assert.throws(()=>transition(next,{action:'answer',revision:0,message:'one'},lesson),/Stale/);
});

test('independent QA: review has no active teaching question or diagram',()=>{
 const s={...initialState(),started:true,phase:'review',index:0};
 const {output}=transition(s,{action:'start'},lesson);
 assert.equal(output.title,'Your learning story');
 assert.equal(output.visual,null);
 assert.equal(output.question,undefined);
});

test('independent QA: spoken negative unit cannot advance',()=>{
 const s={...initialState(),started:true,index:1};
 for(const response of ['-1','−1','negative one','one or two']){
  const result=transition(s,{action:'answer',revision:s.revision,message:response},lesson);
  assert.equal(result.state.index,1,response);
 }
});
test('independent QA: partial-tiling activity requires the missing tiles',()=>{
 const s={...initialState(),started:true,index:4};
 const q=lesson.concepts[4];
 assert.equal(transition(s,{action:'answer',revision:0,message:'12',filled:[]},lesson).state.index,4);
 const filled=[];
 q.visual.rows.forEach((row,r)=>[...row].forEach((cell,c)=>{if(cell==='X'&&q.visual.visible[r][c]==='.')filled.push(r*row.length+c)}));
 assert.equal(transition(s,{action:'answer',revision:0,message:'12',filled},lesson).state.index,5);
});
