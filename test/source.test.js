const test=require('node:test'),assert=require('node:assert/strict');
const {parseHistoryPage,fetchHistoryDraws,parseOfficialLatest,verifyLatest}=require('../lib/source');
const fs=require('node:fs'),path=require('node:path');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name+'.html'),'utf8');
const {SOURCE,HISTORY_SOURCE,mergeDraws}=require('../lib/draws');
const row=(issue='26123',date='2026-10-28',front=[13,18,19,20,28],back=[9,11])=>`<tr><td>${issue}</td><td>${front.map(n=>`<span class="ball-red">${n}</span>`).join('')}${back.map(n=>`<span class="ball-blue">${n}</span>`).join('')}</td><td>${date}</td></tr>`;
const page=(rows=row())=>`<section class="panel"><h2>大乐透历史开奖</h2><table><tbody>${rows}</tbody></table></section>`;
const archived={issue:'26122',date:'2026-10-26',front:[2,14,21,22,24],back:[2,12],sourceUrl:SOURCE};
const oldRow=()=>row(archived.issue,archived.date,archived.front,archived.back);
const official=fixture('official');
test('parses history rows and preserves third-party provenance',()=>{
 const rows=parseHistoryPage(fixture('history'));
 assert.equal(rows.length,2);assert.deepEqual(rows[0],{issue:'26123',date:'2026-10-28',front:[13,18,19,20,28],back:[9,11],sourceUrl:HISTORY_SOURCE});
 assert.equal(rows[1].issue,'26122');
});
test('rejects missing table, missing balls, duplicates, unsorted and out-of-range balls',()=>{
 for(const html of ['<html>blocked</html>',page(''),page(row().replace('<span class="ball-blue">11</span>','')),page(row('26123','2026-10-28',[13,13,19,20,28])),page(row('26123','2026-10-28',[18,13,19,20,28])),page(row('26123','2026-10-28',[13,18,19,20,36]))]) assert.throws(()=>parseHistoryPage(html));
});
test('overlap verifies content and retains original archive provenance',async()=>{
 const calls=[];const rows=await fetchHistoryDraws([archived],async n=>{calls.push(n);return page(n===1?row():oldRow())});
 assert.deepEqual(calls,[1,2]);assert.equal(rows.length,2);
 const merged=mergeDraws([archived],rows);assert.deepEqual(merged[0],archived);
 assert.throws(()=>mergeDraws([archived],[{...archived,sourceUrl:'https://evil.invalid'}]));
});
test('rejects conflicts anywhere on overlapping page',async()=>{
 await assert.rejects(fetchHistoryDraws([archived],async()=>page(row()+oldRow().replace('>24<','>25<'))),/Conflicting/);
});
test('rejects no overlap after exactly twenty pages',async()=>{
 let count=0;await assert.rejects(fetchHistoryDraws([archived],async()=>{count++;return page()}),/overlap/);assert.equal(count,20);
});
test('parses sorted official winning numbers rather than draw order and compares every field',()=>{
 const latest=parseOfficialLatest(official);assert.deepEqual(latest.front,[13,18,19,20,28]);
 const rows=parseHistoryPage(page());assert.equal(verifyLatest(rows,latest),rows[0]);
 for(const changed of [{...latest,issue:'26122'},{...latest,date:'2026-10-27'},{...latest,front:[12,18,19,20,28]},{...latest,back:[8,11]}])assert.throws(()=>verifyLatest(rows,changed),/mismatch/);
 for(const html of ['blocked',official.replace('本期开奖号码','其他号码'),official.replace('09 11','09')])assert.throws(()=>parseOfficialLatest(html));
});

test('rejects duplicate issue content conflicts inside the history table',()=>{
 assert.throws(()=>parseHistoryPage(page(row()+row().replace('>28<','>29<'))),/Conflicting/);
});
test('request accepts only HTTP 200 and limits response bytes without custom headers',async t=>{
 const https=require('node:https'),{EventEmitter}=require('node:events');
 const {requestPage,requestOfficialLatest}=require('../lib/source');
 let status=403,oversize=false;const urls=[];
 t.mock.method(https,'get',(url,callback)=>{
  urls.push(url);assert.equal(typeof callback,'function'); // No options/custom request headers.
  const req=new EventEmitter();req.destroy=error=>{req.emit('error',error);req.emit('close');};
  queueMicrotask(()=>{
   const response=new EventEmitter();response.statusCode=status;response.resume=()=>{};callback(response);
   if(status===200){response.emit('data',Buffer.from(oversize?'x'.repeat(2*1024*1024+1):'html'));response.emit('end');}
   req.emit('close');
  });return req;
 });
 await assert.rejects(requestPage(1),/HTTP 403/);
 status=200;assert.equal(await requestPage(2),'html');
 oversize=true;await assert.rejects(requestOfficialLatest(),/too large/);
 assert.equal(urls[1],HISTORY_SOURCE+'?page=2');
 await assert.rejects(requestPage(0),/Invalid/);
});

test('probe workflow triggers for uploaded source, fixtures and archive files',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/probe.yml'),'utf8');
 for(const expected of ['workflow_dispatch:',"'lib/**'","'scripts/probe.js'","'test/**'","'data/draws.json'",'node --test test/source.test.js','node scripts/probe.js','contents: read'])assert.ok(workflow.includes(expected),expected);
});
