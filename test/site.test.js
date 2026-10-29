const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const appPath=require.resolve('../package.json').replace('package.json','site/app.js');
const record={cutoffIssue:'26122',trainDrawCount:330,sourceStatus:{state:'stale',message:'offline'},tickets:[{front:[1,2,3,4,5],back:[1,2]},{front:[6,7,8,9,10],back:[3,4]}],report:{meanLogScoreDifference:-0.0053,holdoutCount:100}};
async function app(){return import(require('node:url').pathToFileURL(appPath)).then(m=>m.default);}
test('Beijing day selects the saved two tickets without mutation or generation',async()=>{
 const {selectDaily,formatBall}=await app();const saved={records:{'2026-10-29':record}},before=JSON.stringify(saved);
 assert.equal(selectDaily(saved,new Date('2026-10-28T16:05:00Z')),record);
 assert.equal(selectDaily(saved,new Date('2026-10-28T15:59:00Z')),null);
 assert.equal(formatBall(3),'03');assert.equal(JSON.stringify(saved),before);
});
test('view distinguishes current sync from the immutable record cutoff and stale creation status',async()=>{
 const {viewData}=await app();const view=viewData({records:{'2026-10-29':record},sourceStatus:{state:'fresh',cutoffIssue:'26123'},lastSuccessfulSync:'2026-10-29T04:00:00Z'}, {draws:[{issue:'26123'}]},new Date('2026-10-29T04:00:00Z'));
 assert.equal(view.record,record);assert.match(view.recordSummary,/26122.*330/);assert.match(view.recordStatus,/旧数据/);assert.match(view.syncStatus,/fresh/);assert.match(view.syncStatus,/26123/);assert.match(view.syncTime,/2026/);assert.match(view.backtest,/未显示可靠预测优势/);assert.match(view.backtest,/-0.0053/);
});
test('missing or invalid daily tickets never become displayed numbers',async()=>{
 const {viewData}=await app();const time=new Date('2026-10-29T04:00:00Z');
 assert.equal(viewData({records:{}},{draws:[]},time).record,null);
 for(const tickets of [[],[record.tickets[0]], [record.tickets[0],record.tickets[0]], [{front:[5,4,3,2,1],back:[1,2]},record.tickets[1]]])assert.throws(()=>viewData({records:{'2026-10-29':{...record,tickets}}},{draws:[]},time),/号码/);
});
test('published JSON loads from subpath-relative URLs without HTTP cache and fails clearly',async()=>{
 const {fetchData}=await app();const calls=[];const result=await fetchData(async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>url.includes('daily')?{records:{}}:{draws:[]}}});
 assert.deepEqual(calls.map(c=>c[0]),['./data/daily.json','./data/draws.json']);assert.ok(calls.every(c=>c[1].cache==='no-store'));assert.deepEqual(result.daily,{records:{}});
 await assert.rejects(fetchData(async()=>({ok:false,status:503})),/503/);
});
test('HTML exposes accessible status and source links; build copies both exact JSON payloads',async()=>{
 const html=await fs.readFile(path.join(__dirname,'../site/index.html'),'utf8');assert.match(html,/name="viewport"/);assert.match(html,/aria-live="polite"/);assert.match(html,/9011.com.cn\/lottery\/dlt/);assert.match(html,/shsportslottery.com\/dlt\/kjgg.html/);
 const {build}=require('../scripts/build');const temp=await fs.mkdtemp(path.join(os.tmpdir(),'dlt-site-'));
 try{await build(path.join(__dirname,'..'),temp);for(const name of ['daily.json','draws.json'])assert.equal(await fs.readFile(path.join(temp,'data',name),'utf8'),await fs.readFile(path.join(__dirname,'../data',name),'utf8'));}finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('render produces exactly two accessible cards and load failure clears prior tickets',async()=>{
 const {render,load,viewData}=await app();
 class Element{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent='';}append(child){this.children.push(child);}replaceChildren(...items){this.children=items;}setAttribute(name,value){this.attrs[name]=value;}}
 const nodes=new Map();const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element('div'));return nodes.get(id);},createElement(tag){return new Element(tag);}};
 const data={records:{'2026-10-29':record},sourceStatus:{state:'stale',cutoffIssue:'26122'},lastSuccessfulSync:null};const now=new Date('2026-10-29T04:00:00Z');
 render(viewData(data,{draws:[]},now),doc);
 const cards=doc.getElementById('tickets').children;assert.equal(cards.length,2);assert.equal(cards[0].children[1].children[1].children.length,5);assert.equal(cards[0].children[2].children[1].children.length,2);assert.equal(cards[0].children[1].children[1].children[0].attrs['aria-label'],'前区 01');
 render(viewData({records:{}},{draws:[]},now),doc);assert.equal(doc.getElementById('tickets').children.length,0);assert.match(doc.getElementById('status').textContent,/尚未生成/);
 render(viewData(data,{draws:[]},now),doc);
 await load(doc,async()=>{throw Error('网络断开');},now);assert.equal(doc.getElementById('tickets').children.length,0);assert.match(doc.getElementById('status').textContent,/读取数据失败.*网络断开/);
});
