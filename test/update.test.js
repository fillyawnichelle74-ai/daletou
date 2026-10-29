const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {update}=require('../scripts/update');
const archive=fs.readFileSync(path.join(__dirname,'fixtures/initial-draws.json'),'utf8');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name+'.html'),'utf8');
function setup(extra={}) {
 const files=new Map([['data/draws.json',archive],['data/daily.json',JSON.stringify({lastSuccessfulSync:'2026-10-27T00:00:00Z',records:{}})]]);
 let seed=0;const options={loadPage:async()=>fixture('history'),loadOfficial:async()=>fixture('official'),read:async p=>files.get(p),write:async(p,t)=>files.set(p,t),now:()=>new Date('2026-10-28T16:30:00Z'),rng:()=>((seed++*.173)%1),...extra};
 return {files,options,daily:()=>JSON.parse(files.get('data/daily.json'))};
}
test('verified sync adds one draw, preserves provenance and creates Beijing daily tickets',async()=>{
 const s=setup();const result=await update(s.options);assert.deepEqual(result,{date:'2026-10-29',cutoffIssue:'26123',drawCount:331,updated:true});
 const history=JSON.parse(s.files.get('data/draws.json'));assert.equal(history.draws.length,331);assert.deepEqual(history.draws[0],JSON.parse(archive).draws[0]);
 const d=s.daily();assert.equal(d.lastSuccessfulSync,'2026-10-28T16:30:00.000Z');assert.equal(d.sourceStatus.state,'fresh');assert.equal(d.records['2026-10-29'].trainDrawCount,331);assert.equal(d.records['2026-10-29'].tickets.length,2);assert.notDeepEqual(...d.records['2026-10-29'].tickets);
 await update(s.options);assert.equal(JSON.parse(s.files.get('data/draws.json')).draws.length,331);assert.deepEqual(s.daily().records,d.records);
});
for(const failure of ['history','official','mismatch','conflict','invalid'])test(`${failure} failure keeps history and successful timestamp but creates stale daily record`,async()=>{
 const s=setup();if(failure==='history')s.options.loadPage=async()=>{throw Error('HTTP 567')};
 if(failure==='official')s.options.loadOfficial=async()=>{throw Error('HTTP 503')};
 if(failure==='mismatch')s.options.loadOfficial=async()=>fixture('official').replace('26123','26124');
 if(failure==='conflict')s.options.loadPage=async()=>fixture('history').replace('ball-red">24','ball-red">25');
 if(failure==='invalid')s.options.loadPage=async()=>'<html>blocked</html>';
 await update(s.options);assert.equal(s.files.get('data/draws.json'),archive);const d=s.daily();assert.equal(d.lastSuccessfulSync,'2026-10-27T00:00:00Z');assert.equal(d.sourceStatus.state,'stale');assert.equal(d.records['2026-10-29'].cutoffIssue,'26122');assert.equal(d.records['2026-10-29'].tickets.length,2);
 const record=JSON.stringify(d.records['2026-10-29']);await update(s.options);assert.equal(JSON.stringify(s.daily().records['2026-10-29']),record);
});
test('same-day success and later failure keep tickets; next Beijing day creates another record',async()=>{
 const s=setup();await update(s.options);const first=s.daily().records['2026-10-29'];const stamp=s.daily().lastSuccessfulSync;s.options.loadPage=async()=>{throw Error('offline')};await update(s.options);assert.deepEqual(s.daily().records['2026-10-29'],first);assert.equal(s.daily().lastSuccessfulSync,stamp);assert.equal(s.daily().sourceStatus.state,'stale');
 s.options.now=()=>new Date('2026-10-29T16:01:00Z');await update(s.options);assert.equal(Object.keys(s.daily().records).length,2);
});
for(const failure of ['archive','daily','model'])test(`${failure} corruption fails before any writes`,async()=>{
 const s=setup();if(failure==='archive')s.files.set('data/draws.json',archive.replace('"front": [','"front": [99,'));if(failure==='daily')s.files.set('data/daily.json','{}');if(failure==='model')s.options.train=()=>{throw Error('model failed')};const before=[...s.files];await assert.rejects(update(s.options));assert.deepEqual([...s.files],before);
});
test('missing daily file bootstraps and RNG failure publishes no files',async()=>{
 const s=setup();s.files.delete('data/daily.json');await update(s.options);assert.equal(s.daily().lastSuccessfulSync,'2026-10-28T16:30:00.000Z');const bad=setup({rng:()=>.5});const before=[...bad.files];await assert.rejects(update(bad.options),/distinct/);assert.deepEqual([...bad.files],before);
});
test('write failure rejects update so workflow cannot publish a partial pair',async()=>{
 const s=setup();s.options.write=async()=>{throw Error('disk full')};const before=[...s.files];await assert.rejects(update(s.options),/disk full/);assert.deepEqual([...s.files],before);
});
test('second file failure rejects even after history write, preventing workflow publication',async()=>{
 const s=setup();const originalWrite=s.options.write;s.options.write=async(p,t)=>{if(p==='data/daily.json')throw Error('disk full');return originalWrite(p,t);};await assert.rejects(update(s.options),/disk full/);assert.equal(s.daily().lastSuccessfulSync,'2026-10-27T00:00:00Z');
});
test('rejects incomplete or malformed saved daily metadata before source access or writes',async()=>{
 const valid=setup();await update(valid.options);const saved=valid.daily();
 const mutations=[
  ...['cutoffIssue','trainDrawCount','modelVersion','updatedAt','report','sourceStatus'].map(field=>record=>{delete record[field];}),
  record=>{record.cutoffIssue='bad';},record=>{record.trainDrawCount=299;},record=>{record.modelVersion='';},record=>{record.updatedAt='not a timestamp';},
  record=>{record.report={};},record=>{record.report.meanLogScoreDifference=null;},record=>{record.report.interval95=[1,-1];},record=>{record.report.holdoutCount=0;},record=>{record.report.validationCount=-1;},record=>{record.report.uniformLogScore='bad';},record=>{record.report.testCutoffs=[];},
  record=>{record.sourceStatus={};},record=>{record.sourceStatus.state='unknown';},record=>{record.sourceStatus.checkedAt='invalid';},record=>{record.sourceStatus.checkedAt='2026-02-30T00:00:00Z';},record=>{record.sourceStatus.cutoffIssue='24001';},record=>{record.sourceStatus.state='stale';delete record.sourceStatus.message;}
 ];
 for(const mutate of mutations) {
  const s=setup(),daily=structuredClone(saved);mutate(daily.records['2026-10-29']);s.files.set('data/daily.json',JSON.stringify(daily));const before=[...s.files];
  let requested=false;s.options.loadPage=async()=>{requested=true;return fixture('history');};
  await assert.rejects(update(s.options),/Invalid saved daily/);assert.equal(requested,false);assert.deepEqual([...s.files],before);
 }
});
