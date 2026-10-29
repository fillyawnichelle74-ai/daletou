const https = require('node:https');
const {normalizeDraw,mergeDraws,sameDraw,HISTORY_SOURCE,OFFICIAL_LATEST} = require('./draws');
function requestHtml(url) {
  return new Promise((resolve,reject)=>{
    const request=https.get(url,response=>{
      if(response.statusCode!==200){response.resume();reject(Error(`Source HTTP ${response.statusCode}: ${url}`));return;}
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)request.destroy(Error('Source response too large'));else chunks.push(chunk);});
      response.on('error',reject);
      response.on('aborted',()=>reject(Error('Source response aborted')));
      response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
    });
    // Total deadline also covers slow connections and trickling response bodies.
    const timer=setTimeout(()=>request.destroy(Error('Source timeout')),15000);
    request.on('error',reject);request.on('close',()=>clearTimeout(timer));
  });
}
function requestPage(page) {
  if(!Number.isInteger(page)||page<1||page>20)return Promise.reject(Error('Invalid history page'));
  return requestHtml(`${HISTORY_SOURCE}?page=${page}`);
}
function requestOfficialLatest(){return requestHtml(OFFICIAL_LATEST);}
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const cells=row=>[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
function parseHistoryPage(html) {
  if(typeof html!=='string')throw Error('History HTML unavailable');
  const sections=[...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)].filter(m=>/class=["'][^"']*\bpanel\b[^"']*["']/i.test(m[1]) && /<h2\b[^>]*>\s*大乐透历史开奖\s*<\/h2>/i.test(m[2]));
  if(sections.length!==1)throw Error('History panel unavailable');
  const bodies=[...sections[0][2].matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)];
  if(bodies.length!==1)throw Error('History table unavailable');
  const rows=[...bodies[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>{
    const td=cells(m[1]);if(td.length<3)throw Error('Invalid history row');
    const balls=color=>[...td[1].matchAll(new RegExp(`<span\\b[^>]*class=["'][^"']*\\bball-${color}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,'gi'))].map(x=>{const value=text(x[1]);return /^\d{1,2}$/.test(value)?Number(value):NaN;});
    const dates=td.slice(2).map(text).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));
    if(dates.length!==1)throw Error('Invalid history date');
    return normalizeDraw({issue:text(td[0]),date:dates[0],front:balls('red'),back:balls('blue'),sourceUrl:HISTORY_SOURCE});
  });
  if(!rows.length)throw Error('Empty history table');
  mergeDraws([],rows);
  return rows;
}
async function fetchHistoryDraws(existing,loadPage=requestPage) {
  const archive=mergeDraws([],existing),known=new Map(archive.map(x=>[x.issue,x])),all=[];
  for(let page=1;page<=20;page++){
    const rows=parseHistoryPage(await loadPage(page));all.push(...rows);
    mergeDraws(archive,all); // Validate every row before accepting an overlap.
    if(rows.some(row=>known.has(row.issue)))return all;
  }
  throw Error('History did not overlap validated archive in 20 pages');
}
function parseOfficialLatest(html) {
  if(typeof html!=='string')throw Error('Official HTML unavailable');
  const plain=text(html),issues=[...plain.matchAll(/第(\d{5})期开奖公告/g)],date=plain.match(/开奖日期[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const result=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>cells(m[1])).filter(td=>/^本期开奖号码[：:]$/.test(text(td[0]||'')));
  if(issues.length!==1||!date||result.length!==1||result[0].length!==3)throw Error('Official announcement unavailable');
  const numbers=cell=>text(cell).split(/\s+/).map(x=>/^\d{1,2}$/.test(x)?Number(x):NaN);
  return normalizeDraw({issue:issues[0][1],date:`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`,front:numbers(result[0][1]),back:numbers(result[0][2]),sourceUrl:OFFICIAL_LATEST});
}
function verifyLatest(rows,official) {
  const validated=mergeDraws([],rows),latest=validated.at(-1);
  if(!latest||!sameDraw(latest,normalizeDraw(official)))throw Error('Official latest mismatch');
  return rows.find(row=>row.issue===latest.issue);
}
module.exports={requestPage,parseHistoryPage,fetchHistoryDraws,requestOfficialLatest,parseOfficialLatest,verifyLatest};
