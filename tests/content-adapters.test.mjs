import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedOptionOrder} from '../scripts/content-adapters.mjs';
test('published option order is fixed, balanced and preserves answers',()=>{
  const source=Array.from({length:22},(_,i)=>({id:'Q'+i,answer:'A',options:{A:'correct'+i,B:'wrong1',C:'wrong2',D:'wrong3'}}));
  const result=fixedOptionOrder(source,'module:core');assert.deepEqual(result,fixedOptionOrder(source,'module:core'));
  assert.deepEqual(result,fixedOptionOrder(result,'module:core'));
  const count={A:0,B:0,C:0,D:0};result.forEach((q,i)=>{assert.equal(q.options[q.answer],source[i].options.A);count[q.answer]++;});
  assert.ok(Math.max(...Object.values(count))-Math.min(...Object.values(count))<=1);
  assert.notEqual(result.map(q=>q.answer).join(''),'ABCDABCDABCDABCDABCDAB');
});
