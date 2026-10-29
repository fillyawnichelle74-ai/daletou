const fs=require('node:fs/promises');
const path=require('node:path');
const {mergeDraws}=require('../lib/draws');
const {fetchHistoryDraws,requestPage,requestOfficialLatest,parseOfficialLatest,verifyLatest}=require('../lib/source');
const {trainAndEvaluate}=require('../lib/backtest');
const {chinaDate,makeDaily}=require('../lib/daily');
const root=path.join(__dirname,'..');
const read=async name=>{try{return await fs.readFile(path.join(root,name),'utf8');}catch(error){if(error.code==='ENOENT')return undefined;throw error;}};
async function write(name,text) {
 const target=path.join(root,name),temp=`${target}.${process.pid}.tmp`;
 try {await fs.writeFile(temp,text,{flag:'wx'});await fs.rename(temp,target);} finally {await fs.rm(temp,{force:true});}
}
const validTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace(/Z$/,value.includes('.')?'Z':'.000Z');
const validIssue=value=>typeof value==='string'&&/^\d{5}$/.test(value);
function validSourceStatus(status,cutoffIssue) {
 return status&&['fresh','stale'].includes(status.state)&&validTimestamp(status.checkedAt)&&validIssue(status.cutoffIssue)&&(!cutoffIssue||status.cutoffIssue===cutoffIssue)&&(status.state!=='stale'||typeof status.message==='string'&&status.message.trim().length>0);
}
function validReport(report,drawCount) {
 return report&&report.validationCount===drawCount-200&&report.holdoutCount===100&&Number.isFinite(report.meanLogScoreDifference)&&Number.isFinite(report.uniformLogScore)&&Array.isArray(report.interval95)&&report.interval95.length===2&&report.interval95.every(Number.isFinite)&&report.interval95[0]<=report.meanLogScoreDifference&&report.meanLogScoreDifference<=report.interval95[1]&&Array.isArray(report.testCutoffs)&&report.testCutoffs.length===100&&report.testCutoffs.every(validIssue);
}
function validateDaily(daily) {
 if(!daily||typeof daily!=='object'||!daily.records||typeof daily.records!=='object'||Array.isArray(daily.records)||!(daily.lastSuccessfulSync===null||typeof daily.lastSuccessfulSync==='string'&&Number.isFinite(Date.parse(daily.lastSuccessfulSync))))throw Error('Invalid daily archive');
 for(const [date,record] of Object.entries(daily.records)) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||record?.date!==date||!Array.isArray(record.tickets)||record.tickets.length!==2||JSON.stringify(record.tickets[0])===JSON.stringify(record.tickets[1]))throw Error('Invalid saved daily record');
  if(!validIssue(record.cutoffIssue)||!Number.isInteger(record.trainDrawCount)||record.trainDrawCount<300||record.modelVersion!==`${record.cutoffIssue}-${record.trainDrawCount}`||!validTimestamp(record.updatedAt)||chinaDate(new Date(record.updatedAt))!==date||!validReport(record.report,record.trainDrawCount)||!validSourceStatus(record.sourceStatus,record.cutoffIssue))throw Error('Invalid saved daily metadata');
  for(const ticket of record.tickets)for(const [area,count,max] of [['front',5,35],['back',2,12]]) {
   const balls=ticket[area];if(!Array.isArray(balls)||balls.length!==count||balls.some((n,i)=>!Number.isInteger(n)||n<1||n>max||i>0&&n<=balls[i-1]))throw Error('Invalid saved ticket');
  }
 }
 return daily;
}
async function update({loadPage=requestPage,loadOfficial=requestOfficialLatest,read:readFile=read,write:writeFile=write,now=()=>new Date(),rng=Math.random,train=trainAndEvaluate}={}) {
 const instant=now(),timestamp=instant.toISOString(),date=chinaDate(instant);
 const original=await readFile('data/draws.json'),snapshot=JSON.parse(original);
 if(!snapshot||!Array.isArray(snapshot.draws)||!snapshot.draws.length||typeof snapshot.sourceUrl!=='string'||!Number.isFinite(Date.parse(snapshot.capturedAt)))throw Error('Invalid historical archive');
 const existing=mergeDraws([],snapshot.draws);
 if(existing.length!==snapshot.draws.length||JSON.stringify(existing)!==JSON.stringify(snapshot.draws))throw Error('Historical archive must be unique and chronological');
 const dailyText=await readFile('data/daily.json');
 const daily=dailyText===undefined?{lastSuccessfulSync:null,records:{}}:validateDaily(JSON.parse(dailyText));
 let merged=existing,sourceStatus;
 try {
  const incoming=await fetchHistoryDraws(existing,loadPage);
  verifyLatest(incoming,parseOfficialLatest(await loadOfficial()));
  merged=mergeDraws(existing,incoming);
  sourceStatus={state:'fresh',checkedAt:timestamp,cutoffIssue:merged.at(-1).issue};
 } catch(error) {
  sourceStatus={state:'stale',checkedAt:timestamp,cutoffIssue:existing.at(-1).issue,message:String(error.message)};
 }
 // Model and record construction complete before any published file is touched.
 const {model,report}=train(merged);
 if(!model||!report||!Number.isFinite(report.meanLogScoreDifference)||!Number.isInteger(model.trainDrawCount))throw Error('Invalid trained model');
 const records={...daily.records};
 if(!Object.hasOwn(records,date))records[date]={...makeDaily({...model,version:`${model.cutoffIssue}-${merged.length}`,updatedAt:timestamp,report},rng,date),trainDrawCount:merged.length,sourceStatus};
 const nextDaily={...daily,lastSuccessfulSync:sourceStatus.state==='fresh'?timestamp:daily.lastSuccessfulSync,sourceStatus,records};
 validateDaily(nextDaily);
 const updated=merged.length!==existing.length;
 const nextSnapshot={...snapshot,draws:merged};
 const historyText=JSON.stringify(nextSnapshot,null,2)+'\n',nextDailyText=JSON.stringify(nextDaily,null,2)+'\n';
 // Both JSON payloads are prepared before writing. The workflow publishes only
 // after a successful exit, so a filesystem failure cannot publish half a pair.
 JSON.parse(historyText);JSON.parse(nextDailyText);
 if(sourceStatus.state==='fresh'&&updated)await writeFile('data/draws.json',historyText);
 await writeFile('data/daily.json',nextDailyText);
 return {date,cutoffIssue:merged.at(-1).issue,drawCount:merged.length,updated};
}
if(require.main===module)update().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={update};
