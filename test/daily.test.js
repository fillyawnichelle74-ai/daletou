const test=require('node:test'),assert=require('node:assert/strict');
const {chinaDate,makeDaily}=require('../lib/daily');
test('uses China date across UTC boundary',()=>assert.equal(chinaDate(new Date('2026-10-28T16:30:00Z')),'2026-10-29'));
test('creates two distinct complete tickets',()=>{
  const model={frontWeights:Array(35).fill(1),backWeights:Array(12).fill(1),cutoffIssue:'26122',version:'26122',updatedAt:'2026-10-28T00:00:00Z',report:{}};
  let x=0;const daily=makeDaily(model,()=>((x++*0.173)%1),'2026-10-28');
  assert.equal(daily.tickets.length,2);assert.notDeepEqual(daily.tickets[0],daily.tickets[1]);
  assert.ok(daily.tickets.every(t=>t.front.length===5&&t.back.length===2));
});
