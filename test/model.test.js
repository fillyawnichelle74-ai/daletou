const test=require('node:test'),assert=require('node:assert/strict');
const {fitWeights,setLogProbability,sampleSet}=require('../lib/model');
test('uniform model has exact combination probability',()=>{
  assert.ok(Math.abs(setLogProbability(Array(35).fill(1),[1,2,3,4,5])+Math.log(324632))<1e-12);
  assert.ok(Math.abs(Math.exp(setLogProbability(Array(35).fill(1),[1,2,3,4,5])+setLogProbability(Array(12).fill(1),[1,2]))-1/21425712)<1e-18);
  let total=0;for(let a=1;a<=4;a++)for(let b=a+1;b<=4;b++)total+=Math.exp(setLogProbability([1,2,3,4],[a,b]));
  assert.ok(Math.abs(total-1)<1e-12);
});
test('weights are positive and sample is a legal set',()=>{
  const w=fitWeights([{front:[1,2,3,4,5],back:[1,2]}],'front',.98,25);
  assert.equal(w.length,35);assert.ok(w.every(x=>x>0));
  const s=sampleSet(w,5,()=>.4);assert.equal(s.length,5);assert.equal(new Set(s).size,5);
});
