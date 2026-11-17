import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/study-core.js';
const C=globalThis.StudyCore;
test('Leitner ratings reset, retain, advance and cap boxes with real due dates',()=>{
  const t=1000,old={box:3,seen:8,lapses:2};
  assert.equal(C.review(old,0,t).box,0);assert.equal(C.review(old,0,t).lapses,3);
  assert.equal(C.review(old,1,t).box,3);assert.equal(C.review(old,1,t).due,t+7*86400000);
  assert.equal(C.review(old,2,t).box,4);assert.equal(C.review(old,3,t).box,5);
  assert.equal(C.review({box:5},3,t).box,5);assert.equal(C.review(old,2,t).seen,9);
  assert.equal(C.review(old,3,t).due,t+35*86400000);assert.throws(()=>C.review(old,4,t));
});
test('due boundaries and seeded test ordering are deterministic',()=>{
  assert.ok(C.due(null,0));assert.ok(C.due({due:20},20));assert.equal(C.due({due:21},20),false);
  const ids=Array.from({length:30},(_,i)=>i);assert.deepEqual(C.shuffle(ids,42),C.shuffle(ids,42));assert.notDeepEqual(C.shuffle(ids,42),C.shuffle(ids,43));assert.deepEqual([...C.shuffle(ids,42)].sort((a,b)=>a-b),ids);
});
test('test grading includes unanswered questions and module breakdown',()=>{
  const r=C.score([{id:'a',module:'M1',answer:1},{id:'b',module:'M1',answer:2},{id:'c',module:'M2',answer:0}],{a:1,b:0});
  assert.deepEqual([r.correct,r.total,r.answered,r.unanswered,r.percent],[1,3,2,1,33]);assert.deepEqual(r.wrong,['b','c']);assert.deepEqual(r.byModule.M1,{correct:1,total:2});
});
