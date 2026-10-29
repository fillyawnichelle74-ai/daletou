const test=require('node:test'),assert=require('node:assert/strict');
const {trainAndEvaluate}=require('../lib/backtest');
const history=require('./fixtures/initial-draws.json').draws;
test('holdout draws never enter their own fitted history',()=>{
  const {model,report}=trainAndEvaluate(history);
  assert.equal(report.holdoutCount,100);
  assert.equal(model.cutoffIssue,history.at(-1).issue);
  assert.ok(report.testCutoffs.every((x,i)=>Number(x)<Number(history[history.length-100+i].issue)));
});
test('at least 300 draws required',()=>assert.throws(()=>trainAndEvaluate(history.slice(0,299))));
